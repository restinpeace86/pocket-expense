"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// 사내 메신저 실시간 연결 하나(D-203): 내 비공개 주제 'chat:{member_id}'를 한 번만 구독하고,
// 메뉴 배지·채팅 목록·대화방이 같은 연결을 나눠 쓴다(같은 주제를 두 번 구독하면 Supabase가 같은 채널을 돌려주므로).
// 다시 연결되거나 화면이 다시 보이면 'reconnect'를 보내 빠진 메시지를 다시 불러오게 한다(실시간 전달은 100% 보장되지 않음).
export type ChatEvent =
  | { event: "message" | "message_update"; payload: Record<string, unknown> }
  | { event: "read"; payload: { room_id: string; member_id: string; last_read_at: string } }
  | { event: "room"; payload: { room_id: string; left?: string } }
  | { event: "reconnect"; payload: Record<string, never> };
type Listener = (e: ChatEvent) => void;

type Hub = { memberId: string; listeners: Set<Listener>; channel: RealtimeChannel | null; closing: ReturnType<typeof setTimeout> | null; subscribedOnce: boolean };
let hub: Hub | null = null;

function emit(e: ChatEvent) {
  for (const l of hub?.listeners ?? []) {
    try {
      l(e);
    } catch {
      // 한 화면의 오류가 다른 화면 알림을 막지 않게
    }
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") emit({ event: "reconnect", payload: {} });
};

async function open(h: Hub) {
  const supabase = createClient();
  await supabase.realtime.setAuth();
  if (hub !== h) return;
  const ch = supabase.channel(`chat:${h.memberId}`, { config: { private: true } });
  for (const ev of ["message", "message_update", "read", "room"] as const) {
    ch.on("broadcast", { event: ev }, ({ payload }) => emit({ event: ev, payload } as ChatEvent));
  }
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    if (h.subscribedOnce) emit({ event: "reconnect", payload: {} });
    h.subscribedOnce = true;
  });
  h.channel = ch;
  document.addEventListener("visibilitychange", onVisible);
}

function close(h: Hub) {
  document.removeEventListener("visibilitychange", onVisible);
  if (h.channel) void createClient().removeChannel(h.channel);
  if (hub === h) hub = null;
}

export function subscribeChat(memberId: string, listener: Listener): () => void {
  if (hub && hub.memberId !== memberId) {
    if (hub.closing) clearTimeout(hub.closing);
    close(hub);
  }
  if (!hub) {
    hub = { memberId, listeners: new Set(), channel: null, closing: null, subscribedOnce: false };
    void open(hub);
  }
  const h = hub;
  if (h.closing) {
    clearTimeout(h.closing);
    h.closing = null;
  }
  h.listeners.add(listener);
  return () => {
    h.listeners.delete(listener);
    // 화면을 옮길 때 끊었다 다시 붙지 않게 잠깐 기다렸다 닫는다
    if (!h.listeners.size) h.closing = setTimeout(() => close(h), 3000);
  };
}
