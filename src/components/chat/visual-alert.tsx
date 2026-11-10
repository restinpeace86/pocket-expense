"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { roomTitle, type ChatKind, type ChatRoomSummary } from "@/lib/chat/format";
import { alertText, pushToast, PULSE_GAP_MS, shouldAlert, TOAST_MS, VISUAL_ALERT_EVENT, type AlertMessage, type AlertToast } from "@/lib/chat/visual-alert";
import { OPEN_THREAD_EVENT } from "@/lib/chat/threads";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./avatar";
import { subscribeChat } from "./hub";
import { useChatPopup } from "./popup";

type RoomInfo = { title: string; kind: ChatKind };

// PC 무소음 시각 알림(D-246, spec §B): 새 채팅 메시지 → 오른쪽 아래 3초 토스트 + 가장자리 파란빛 짧게 2번.
// PC(md 이상)·화면이 보일 때만, 그 방을 보고 있으면 안 띄움. [내 정보]에서 끄면 바로 꺼짐(VISUAL_ALERT_EVENT)
export function ChatVisualAlert({ memberId, companyId, initialOn }: { memberId: string; companyId: string; initialOn: boolean }) {
  const ws = `/workspace/${companyId}`;
  const pathname = usePathname();
  const router = useRouter();
  const popup = useChatPopup();
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const [pulse, setPulse] = useState(0);
  const on = useRef(initialOn);
  const path = useRef(pathname);
  const rooms = useRef(new Map<string, RoomInfo>());
  const seen = useRef(new Set<string>());
  const lastPulse = useRef(0);

  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onToggle = (e: Event) => {
      on.current = (e as CustomEvent<boolean>).detail === true;
      if (!on.current) setToasts([]);
    };
    window.addEventListener(VISUAL_ALERT_EVENT, onToggle);
    return () => window.removeEventListener(VISUAL_ALERT_EVENT, onToggle);
  }, []);

  const roomInfo = useCallback(
    async (roomId: string): Promise<RoomInfo | null> => {
      const hit = rooms.current.get(roomId);
      if (hit) return hit;
      const { data } = await createClient().rpc("chat_room_list");
      for (const r of (data as unknown as ChatRoomSummary[]) ?? []) rooms.current.set(r.id, { title: roomTitle(r, memberId), kind: r.kind });
      return rooms.current.get(roomId) ?? null;
    },
    [memberId],
  );

  useEffect(() => {
    if (popup) return; // 채팅 새 창은 채팅만 보임
    return subscribeChat(memberId, (e) => {
      if (e.event === "room") {
        rooms.current.delete(e.payload.room_id); // 이름이 바뀌었을 수 있음
        return;
      }
      // 서브 대화 글(D-246): 내가 참여자일 때만, 그 서브 대화를 열어 보고 있으면 안 띄움
      if (e.event === "thread_message") {
        const p = e.payload;
        if (!p.insert || !p.participants.includes(memberId) || seen.current.has(p.message.id)) return;
        seen.current.add(p.message.id);
        const viewing = path.current === `${ws}/chat/${p.room_id}` && document.body.dataset.openThread === p.thread.id;
        const ok = !viewing && shouldAlert(p.message as unknown as AlertMessage, { meId: memberId, ws, pathname: "", enabled: on.current, wide: window.matchMedia("(min-width: 768px)").matches, visible: document.visibilityState === "visible" });
        if (!ok) return;
        void roomInfo(p.room_id).then((info) => {
          const at = Date.now();
          setToasts((l) => pushToast(l, { roomId: p.room_id, threadId: p.thread.id, sender: p.message.sender_name, room: `${info?.title ?? "채팅"} › ${p.thread.title}`, text: alertText(p.message as unknown as AlertMessage, null), at }));
          if (at - lastPulse.current > PULSE_GAP_MS) {
            lastPulse.current = at;
            setPulse(at);
          }
        });
        return;
      }
      if (e.event !== "message") return;
      const msg = e.payload as unknown as AlertMessage;
      if (!msg?.id || seen.current.has(msg.id)) return;
      seen.current.add(msg.id);
      const ok = shouldAlert(msg, {
        meId: memberId,
        ws,
        pathname: path.current,
        enabled: on.current,
        wide: window.matchMedia("(min-width: 768px)").matches,
        visible: document.visibilityState === "visible",
      });
      if (!ok) return;
      void roomInfo(msg.room_id).then((info) => {
        const at = Date.now();
        const isNotice = info?.kind === "notice";
        setToasts((l) =>
          pushToast(l, {
            roomId: msg.room_id,
            sender: isNotice ? null : msg.sender_name,
            room: info?.title ?? "채팅",
            text: alertText(msg, info?.kind ?? null),
            at,
          }),
        );
        if (at - lastPulse.current > PULSE_GAP_MS) {
          lastPulse.current = at;
          setPulse(at);
        }
      });
    });
  }, [memberId, ws, popup, roomInfo]);

  const close = useCallback((key: string) => setToasts((l) => l.filter((t) => t.key !== key)), []);
  const go = (t: AlertToast) => {
    close(t.key);
    if (!t.threadId) return router.push(`${ws}/chat/${t.roomId}`);
    router.push(`${ws}/chat/${t.roomId}?thread=${t.threadId}`);
    window.dispatchEvent(new CustomEvent(OPEN_THREAD_EVENT, { detail: { roomId: t.roomId, threadId: t.threadId } }));
  };

  if (popup) return null;
  return (
    <>
      {pulse > 0 && <div key={pulse} aria-hidden className="workon-edge-pulse pointer-events-none fixed inset-0 z-[69] hidden md:block" onAnimationEnd={() => setPulse(0)} data-visual-pulse />}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[70] hidden w-[340px] flex-col gap-2 md:flex [body:has(.kb-hide.fixed)_&]:bottom-28 [body:has([data-kakao-fab])_&]:bottom-24"
        data-visual-toasts
      >
        {toasts.map((t) => (
          <Toast key={t.key} t={t} onOpen={() => go(t)} onClose={() => close(t.key)} />
        ))}
      </div>
    </>
  );
}

function Toast({ t, onOpen, onClose }: { t: AlertToast; onOpen: () => void; onClose: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onClose, TOAST_MS);
  }, [onClose]);
  // 같은 방 새 글이 오면 3초를 다시 잼(마우스가 올라가 있으면 그대로 멈춤)
  useEffect(() => {
    if (!hovered.current) start();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [start, t.at]);
  return (
    <div
      className="workon-toast-in pointer-events-auto flex items-start gap-1 rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-[0_10px_30px_rgba(0,0,0,0.14)]"
      onMouseEnter={() => {
        hovered.current = true;
        if (timer.current) clearTimeout(timer.current);
      }}
      onMouseLeave={() => {
        hovered.current = false;
        start();
      }}
      data-visual-toast={t.roomId}
      data-visual-thread={t.threadId ?? undefined}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2.5 rounded-2xl py-3 pl-3.5 text-left hover:bg-zinc-50">
        <Avatar name={t.sender ?? t.room} id={t.roomId} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <b className="shrink-0 text-sm">{t.sender ?? t.room}</b>
            {t.sender && <span className="truncate text-xs text-zinc-600">{t.room}</span>}
            {t.count > 1 && <span className="ml-auto shrink-0 rounded-full bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700">+{t.count - 1}</span>}
          </span>
          <span className="mt-0.5 block truncate text-[13.5px] text-zinc-800">{t.text}</span>
          <span className="mt-0.5 block text-[11.5px] text-brand-700">누르면 그 대화로 가요</span>
        </span>
      </button>
      <button type="button" onClick={onClose} aria-label="알림 닫기" className="m-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
