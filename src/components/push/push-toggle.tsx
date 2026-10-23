"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { deletePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/app/push/actions";

// 이 기기에서 알림 받기 (D-116): 마감 리마인더 · 결재 대기 · 공지. 무료 웹푸시.
// 아이폰(iOS 16.4+)은 Safari [공유 › 홈 화면에 추가]로 연 앱에서만 켤 수 있다.
type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detect(): Exclude<State, "loading" | "on" | "off"> | null {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null;
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let alive = true;
    (async () => {
      const blocked = detect();
      if (blocked) return alive && setState(blocked);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (alive) setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = () =>
    start(async () => {
      setMsg(null);
      if (!key) return setMsg("알림 서버 설정이 아직 안 돼 있어요.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const r = await savePushSubscriptionAction(json, navigator.userAgent);
        if (!r.ok) return setMsg(r.error);
        setState("on");
        setMsg("알림을 켰어요. 시험 알림으로 확인해 보세요.");
      } catch {
        setMsg("이 브라우저에서는 알림을 켜지 못했어요.");
      }
    });

  const turnOff = () =>
    start(async () => {
      setMsg(null);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
      setMsg("이 기기에서 알림을 껐어요.");
    });

  const test = () =>
    start(async () => {
      setMsg(null);
      const r = await sendTestPushAction();
      setMsg(r.ok ? "시험 알림을 보냈어요. 몇 초 안에 와요." : r.error);
    });

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-label="알림 받기">
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${state === "on" ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"}`}>
          {state === "on" ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">이 기기에서 알림 받기</p>
          <p className="text-sm text-zinc-600">정산 마감 리마인더, 결재 대기 알림, 공지를 이 휴대폰·PC로 받아요. 무료예요.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === "loading" && <Loader2 className="size-4 animate-spin text-zinc-400" />}
        {state === "off" && (
          <button type="button" disabled={pending} onClick={turnOn} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" />}
            알림 켜기
          </button>
        )}
        {state === "on" && (
          <>
            <span className="text-sm font-medium text-green-700">✓ 켜져 있어요</span>
            <button type="button" disabled={pending} onClick={test} className="min-h-11 rounded-xl border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60">
              시험 알림
            </button>
            <button type="button" disabled={pending} onClick={turnOff} className="min-h-11 rounded-xl px-3 text-sm text-zinc-500 underline underline-offset-2 disabled:opacity-60">
              끄기
            </button>
          </>
        )}
        {state === "ios-install" && <p className="text-sm text-zinc-600">아이폰은 Safari 아래 [공유] → [홈 화면에 추가]로 연 앱에서 알림을 켤 수 있어요.</p>}
        {state === "denied" && <p className="text-sm text-amber-700">이 브라우저에서 알림이 막혀 있어요. 브라우저(또는 휴대폰) 설정 › 알림에서 이 사이트를 허용해 주세요.</p>}
        {state === "unsupported" && <p className="text-sm text-zinc-500">이 브라우저는 웹 알림을 지원하지 않아요.</p>}
      </div>
      {msg && (
        <p className="mt-2 text-sm text-zinc-700" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
