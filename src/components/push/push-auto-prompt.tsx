"use client";

import { Bell, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePushSubscription } from "./push-toggle";

// 알림 기본 켜기(D-213): 브라우저는 사이트가 알림을 마음대로 켜지 못하게 해서(사용자가 [허용]을 눌러야 함) "기본 켜짐"은
// ① 이 브라우저에서 이미 허용했는데 이 기기 구독이 없으면 → 묻지 않고 바로 등록 ② 아직 묻지 않았으면 → 워크스페이스에 들어올 때 이 안내를 띄움
// ③ 아이폰 Safari 탭이면 → 홈 화면에 추가하라는 안내. [나중에]는 7일 동안 다시 묻지 않음(쿠키). 막혀 있거나 지원 안 하면 띄우지 않음
// [나중에]·[확인]은 쿠키로 7일(만료되면 다시 물음)
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
  const [show, setShow] = useState(false);
  const auto = useRef(false);
  const on = useRef(turnOn);
  useEffect(() => {
    on.current = turnOn;
  });

  useEffect(() => {
    if (state !== "off" && state !== "ios-install") return;
    if (state === "off" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      // 이미 허용한 브라우저: 묻지 않고 이 기기를 등록
      if (!auto.current) {
        auto.current = true;
        on.current();
      }
      return;
    }
    if (askedRecently()) return;
    const t = setTimeout(() => setShow(true), 1200); // 첫 화면을 먼저 보여 준 뒤
    return () => clearTimeout(t);
  }, [state]);

  if (!show || (state !== "off" && state !== "ios-install")) return null;
  const close = () => {
    markAsked();
    setShow(false);
  };
  return (
    <div
      role="dialog"
      aria-label="알림 켜기 안내"
      data-keyboard-self
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Bell className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">알림을 켜 둘까요?</p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">
            {state === "ios-install"
              ? "아이폰은 Safari 아래 [공유] → [홈 화면에 추가]를 한 뒤, 홈 화면 아이콘으로 열면 결재 요청·반려·채팅 알림을 받을 수 있어요."
              : "결재 요청·반려·정산 지급, 채팅 새 메시지를 이 기기로 바로 알려 드려요. 무료예요."}
          </p>
        </div>
        <button type="button" onClick={close} aria-label="닫기" className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="min-h-11 rounded-xl px-4 text-sm text-zinc-600 hover:bg-zinc-100">
          {state === "ios-install" ? "확인" : "나중에"}
        </button>
        {state === "off" && (
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
