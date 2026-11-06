"use client";

import { Bell, BellOff, Info, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { deletePushSubscriptionAction, getPushVibrateAction, savePushSubscriptionAction, sendTestPushAction, setPushVibrateAction } from "@/app/push/actions";
import { useInstallPrompt } from "./install";
import { ANDROID_APK_READY } from "@/lib/app-download";
import { isNativeApp, nativePushOff, nativePushOn, nativePushState } from "./native";
import { deleteOfficePushAction, saveOfficePushAction, testOfficePushAction } from "@/app/tax-office/push-actions";

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

// 이 기기 알림 상태·켜기/끄기. 설정 화면의 PushToggle과 채팅 목록 안내 줄(D-203)이 함께 쓴다
// office: 세무사무소 계정용(고객사 마감 완료·자료 요청 답변, D-168) — 구독 표가 따로다
export function usePushSubscription(office = false) {
  const save = office ? saveOfficePushAction : savePushSubscriptionAction;
  const remove = office ? deleteOfficePushAction : deletePushSubscriptionAction;
  const sendTest = office ? testOfficePushAction : sendTestPushAction;
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // 안드로이드 설치 앱(D-228): 웹 알림 대신 앱 알림(FCM). 세무사무소 계정은 웹 알림 그대로
  const app = !office && isNativeApp();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!office && isNativeApp()) {
        const s = await nativePushState();
        if (alive) setState(s);
        return;
      }
      const blocked = detect();
      if (blocked) return alive && setState(blocked);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      // 바뀐 서비스 워커(알림 모양·누르면 열기, D-214)를 바로 받도록 확인만 한 번
      reg?.update().catch(() => undefined);
      const sub = await reg?.pushManager.getSubscription();
      if (alive) {
        setState(sub && Notification.permission === "granted" ? "on" : "off");
        setEndpoint(sub?.endpoint ?? null);
      }
    })().catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [office]);

  const turnOn = () =>
    start(async () => {
      setMsg(null);
      if (app) {
        const r = await nativePushOn();
        if (r.ok) {
          setState("on");
          setMsg("알림을 켰어요. 시험 알림으로 확인해 보세요.");
        } else if (r.error === "denied") setState("denied");
        else setMsg(r.error);
        return;
      }
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
        const r = await save(json, navigator.userAgent);
        if (!r.ok) return setMsg(r.error);
        setEndpoint(json.endpoint);
        setState("on");
        setMsg("알림을 켰어요. 시험 알림으로 확인해 보세요.");
      } catch {
        setMsg("이 브라우저에서는 알림을 켜지 못했어요.");
      }
    });

  const turnOff = () =>
    start(async () => {
      setMsg(null);
      if (app) {
        await nativePushOff();
        setState("off");
        setMsg("이 기기에서 알림을 껐어요.");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
      setEndpoint(null);
      setMsg("이 기기에서 알림을 껐어요.");
    });

  const test = () =>
    start(async () => {
      setMsg(null);
      const r = await sendTest();
      setMsg(r.ok ? "시험 알림을 보냈어요. 몇 초 안에 와요." : r.error);
    });

  return { state, msg, pending, turnOn, turnOff, test, endpoint, app };
}

export function PushToggle({ office = false }: { office?: boolean } = {}) {
  const { state, msg, pending, turnOn, turnOff, test, endpoint, app } = usePushSubscription(office);
  const inst = useInstallPrompt();
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-label="알림 받기">
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${state === "on" ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"}`}>
          {state === "on" ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">이 기기에서 알림 받기</p>
          <p className="text-sm text-zinc-600">{office ? "고객사가 세무 마감을 하거나 자료 요청에 답하면 이 휴대폰·PC로 알려 드려요. 무료예요." : "정산 마감 리마인더, 결재 대기 알림, 공지를 이 휴대폰·PC로 받아요. 무료예요."}</p>
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
        {state === "on" && !office && !app && endpoint && <VibrateSwitch endpoint={endpoint} />}
        {state === "on" && app && (
          <p className="w-full border-t border-zinc-100 pt-2 text-xs leading-relaxed text-zinc-600">
            채팅 알림은 길게 진동하고 소리가 나요. 바꾸려면 휴대폰 설정 › 애플리케이션 › WORKON › 알림 › <b>채팅</b>에서 진동 패턴·소리를 고르세요.
          </p>
        )}
        {inst.kind === "prompt" && !inst.installed && (
          <button
            type="button"
            onClick={() => void inst.install().catch(() => false)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-600 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Smartphone className="size-4" />
            홈 화면에 추가
          </button>
        )}
        {inst.installed && !app && <span className="text-sm text-green-700">✓ 홈 화면에 추가했어요. 아이콘으로 열어 주세요.</span>}
        {/* 안드로이드 설치 앱(D-228): 안드로이드 브라우저 = 받기, PC = 휴대폰으로 찍을 QR 화면 */}
        {ANDROID_APK_READY && !office && !app && (inst.kind === "prompt" || inst.kind === "android-manual") && (
          <a href="/download" className="inline-flex min-h-11 w-full items-center text-sm font-semibold text-brand-700 underline underline-offset-2">
            알림이 더 확실한 안드로이드 설치 앱 받기 →
          </a>
        )}
        {ANDROID_APK_READY && !office && inst.kind === "desktop" && (
          <a href="/download" className="inline-flex min-h-11 items-center text-sm text-brand-700 underline underline-offset-2">
            휴대폰 앱 받기(QR)
          </a>
        )}
        {state === "ios-install" && <p className="text-sm text-zinc-600">아이폰은 Safari 아래 [공유] → [홈 화면에 추가]로 연 앱에서 알림을 켤 수 있어요.</p>}
        {state === "denied" && (
          <p className="text-sm text-amber-700">
            {app ? "알림이 막혀 있어요. 휴대폰 설정 › 애플리케이션 › WORKON › 알림에서 허용해 주세요." : "이 브라우저에서 알림이 막혀 있어요. 브라우저(또는 휴대폰) 설정 › 알림에서 이 사이트를 허용해 주세요."}
          </p>
        )}
        {state === "unsupported" && <p className="text-sm text-zinc-500">이 브라우저는 웹 알림을 지원하지 않아요.</p>}
      </div>
      {msg && (
        <p className="mt-2 text-sm text-zinc-700" role="status">
          {msg}
        </p>
      )}
      <PushHelp className="mt-2 -ml-1.5 text-zinc-600" />
    </section>
  );
}

// 이 기기 [알림 올 때 소리·진동](D-214). 끄면 배너만 조용히(무음 모드처럼). 휴대폰이 무음·진동 모드면 그 설정을 따른다
function VibrateSwitch({ endpoint }: { endpoint: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    let alive = true;
    getPushVibrateAction(endpoint).then((v) => alive && setOn(v ?? true)).catch(() => alive && setOn(true));
    return () => {
      alive = false;
    };
  }, [endpoint]);
  if (on === null) return null;
  const flip = () =>
    start(async () => {
      const next = !on;
      setErr(null);
      setOn(next);
      const r = await setPushVibrateAction(endpoint, next);
      if (!r.ok) {
        setOn(!next);
        setErr(r.error);
      }
    });
  return (
    <div className="flex w-full flex-col gap-1 border-t border-zinc-100 pt-2">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-900">알림 올 때 소리·진동</span>
          <span className="block text-xs text-zinc-500">{on ? "길게 진동해요. 휴대폰이 무음이면 울리지 않아요." : "소리·진동 없이 배너만 조용히 떠요."}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="알림 올 때 소리·진동"
          disabled={pending}
          onClick={flip}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brand-600" : "bg-zinc-300"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </label>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}

// ⓘ 알림 받는 조건(기기별). 설정의 [이 기기에서 알림 받기]와 채팅 목록 안내 줄에서 함께 쓴다
export function PushHelp({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1.5 text-sm font-medium underline-offset-2 hover:underline"
      >
        <Info className="size-4" aria-hidden />
        알림 받는 조건
      </button>
      {open && (
        <div role="region" aria-label="알림 받는 조건" className="mt-1 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-700">
          <p>
            <b className="text-zinc-900">공통</b> 휴대폰·PC마다 한 번씩 <b>[알림 켜기]</b>를 누르고, 알림을 물어보면 <b>[허용]</b>을 눌러 주세요. 휴대폰 상단 알림
            배너·잠금화면에 떠요.
          </p>
          <p>
            <b className="text-zinc-900">안드로이드</b> 크롬(또는 삼성 인터넷)에서 켜면 앱을 닫아도 와요. 안 오면 휴대폰 설정 › 애플리케이션 › Chrome(삼성 인터넷) › <b>알림 허용</b>, 배터리 ›{" "}
            <b>제한 없음</b>을 확인해 주세요.
          </p>
          <p>
            <b className="text-zinc-900">아이폰</b> iOS 16.4 이상, Safari에서 <b>[공유] → [홈 화면에 추가]</b>를 한 뒤, 홈 화면에 생긴 아이콘으로 열어서 켜야 와요. Safari
            탭이나 카카오톡 안에서 연 화면에서는 알림이 오지 않아요.
          </p>
          <p>
            <b className="text-zinc-900">PC</b> 크롬·엣지가 켜져 있으면 화면 오른쪽 아래 윈도우 알림으로 떠요. 창을 다 닫아도 받으려면 크롬 설정 › 시스템 ›{" "}
            <b>Chrome을 닫아도 백그라운드 앱 계속 실행</b>을 켜 주세요. 윈도우 &lsquo;방해 금지(집중 모드)&rsquo;가 켜져 있으면 안 보여요.
          </p>
          <p>
            <b className="text-zinc-900">홈 화면에 추가</b> 휴대폰은 홈 화면에 아이콘을 두고 그 아이콘으로 열면 알림이 가장 잘 와요(아이폰은 꼭 필요). 안드로이드는 아래 <b>[홈 화면에 추가]</b> 버튼(또는 ⋮ 메뉴 › 홈 화면에 추가), 아이폰은 Safari [공유] › 홈 화면에 추가. 알림을 누르면 그 대화방·화면이 바로 열려요.
          </p>
          <p>
            <b className="text-zinc-900">소리·진동</b> [알림 올 때 소리·진동]을 켜면 길게 울려요. 휴대폰이 무음이면 배너만 뜨고, 진동 세기·모양은 휴대폰 설정 › 알림 › 크롬(삼성
            인터넷) 쪽 설정을 따라요.
          </p>
          <p>
            <b className="text-zinc-900">막혀 있을 때</b> 주소창 왼쪽 자물쇠(사이트 정보) › 알림 › <b>허용</b>으로 바꿔 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
