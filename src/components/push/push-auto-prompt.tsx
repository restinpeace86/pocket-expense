"use client";

import { Bell, Check, Loader2, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useInstallPrompt } from "./install";
import { usePushSubscription } from "./push-toggle";

// 알림 기본 켜기(D-213) + 홈 화면에 추가(D-219)
// 브라우저는 사이트가 알림을 마음대로 켜거나 바탕화면 아이콘을 몰래 만들지 못하게 해서(사용자가 눌러야 함):
// ① 이미 알림을 허용한 브라우저인데 이 기기 구독이 없으면 → 묻지 않고 바로 등록
// ② 휴대폰 브라우저 탭이면 → "1. 홈 화면에 추가 → 2. 알림 켜기" 두 단계 안내(안드로이드는 버튼 한 번에 휴대폰의 추가 창, 아이폰은 메뉴 안내)
//    홈 화면 아이콘(앱)으로 연 경우·PC는 → 알림 켜기만
// [나중에]·[확인]은 쿠키로 7일(만료되면 다시 물음). 막혀 있거나 지원 안 하면 알림 단계는 빼고 안내
const ASK_COOKIE = "pe_push_ask";
const ASK_AGAIN_S = 7 * 86400;

function askedRecently(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${ASK_COOKIE}=`));
}
function markAsked() {
  document.cookie = `${ASK_COOKIE}=1; path=/; max-age=${ASK_AGAIN_S}; samesite=lax`;
}

export function PushAutoPrompt() {
  const { state, pending, turnOn } = usePushSubscription();
  const { kind, installed, install } = useInstallPrompt();
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);
  const auto = useRef(false);
  const on = useRef(turnOn);
  useEffect(() => {
    on.current = turnOn;
  });

  // 서비스 워커를 미리 등록해 둔다(홈 화면 추가·알림 준비 — 알림 권한은 묻지 않음)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((r) => r ?? navigator.serviceWorker.register("/sw.js"))
      .catch(() => undefined);
  }, []);

  const mobileTab = kind === "prompt" || kind === "ios" || kind === "android-manual";
  useEffect(() => {
    if (state === "loading" || kind === null) return;
    if (state === "off" && typeof Notification !== "undefined" && Notification.permission === "granted" && !auto.current) {
      // 이미 허용한 브라우저: 묻지 않고 이 기기를 등록
      auto.current = true;
      on.current();
    }
    const needPush = state === "off" && !(typeof Notification !== "undefined" && Notification.permission === "granted");
    const needInstall = mobileTab && !installed;
    if (!needPush && !needInstall && state !== "ios-install") return;
    if (askedRecently()) return;
    const t = setTimeout(() => setShow(true), 1200); // 첫 화면을 먼저 보여 준 뒤
    return () => clearTimeout(t);
  }, [state, kind, mobileTab, installed]);

  if (!show) return null;
  const close = () => {
    markAsked();
    setShow(false);
  };
  const pushStep = state === "off" || state === "on";
  const installStep = mobileTab;
  return (
    <div
      role="dialog"
      aria-label="알림 켜기 안내"
      data-keyboard-self
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          {installStep ? <Smartphone className="size-5" /> : <Bell className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{installStep ? "앱처럼 쓰고 알림 받기" : "알림을 켜 둘까요?"}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">
            {installStep
              ? "홈 화면에 아이콘을 두면 앱처럼 바로 열리고, 결재·채팅 알림도 더 잘 와요."
              : "결재 요청·반려·정산 지급, 채팅 새 메시지를 이 기기로 바로 알려 드려요. 무료예요."}
          </p>
        </div>
        <button type="button" onClick={close} aria-label="닫기" className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
          <X className="size-4" />
        </button>
      </div>

      {installStep && (
        <ol className="mt-3 flex flex-col gap-2" aria-label="앱처럼 쓰기 단계">
          <li className="rounded-xl border border-zinc-200 p-3">
            <p className="text-sm font-semibold">1. 홈 화면에 추가</p>
            {installed ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-green-700">
                <Check className="size-4" /> 홈 화면에 아이콘이 생겼어요. 다음부터는 아이콘으로 열어 주세요.
              </p>
            ) : kind === "prompt" ? (
              <button
                type="button"
                disabled={installing}
                onClick={async () => {
                  setInstalling(true);
                  await install().catch(() => false);
                  setInstalling(false);
                }}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {installing ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
                홈 화면에 추가
              </button>
            ) : kind === "ios" ? (
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                Safari 아래 <b>[공유]</b>(네모에 화살표) → <b>[홈 화면에 추가]</b> → <b>[추가]</b>. 아이폰은 홈 화면 아이콘으로 열어야 알림을 받을 수 있어요.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                주소창 오른쪽 <b>⋮ 메뉴</b>(삼성 인터넷은 아래 <b>≡</b>) → <b>[홈 화면에 추가]</b>. 이미 추가했다면 홈 화면 아이콘으로 열어 주세요.
              </p>
            )}
          </li>
          {pushStep && (
            <li className="rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-semibold">2. 알림 켜기</p>
              {state === "on" ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-green-700">
                  <Check className="size-4" /> 알림이 켜져 있어요.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => turnOn()}
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-600 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
                  알림 켜기
                </button>
              )}
            </li>
          )}
        </ol>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="min-h-11 rounded-xl px-4 text-sm text-zinc-600 hover:bg-zinc-100">
          {installStep ? (installed && state === "on" ? "확인" : "나중에") : state === "ios-install" ? "확인" : "나중에"}
        </button>
        {!installStep && state === "off" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              markAsked();
              turnOn();
              setShow(false);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            알림 켜기
          </button>
        )}
      </div>
    </div>
  );
}
