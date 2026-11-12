"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { useSyncExternalStore } from "react";
import { isNativeApp } from "./native";

// 승인 대기 화면(D-232): 웹에서 가입 신청한 직원에게 "기다리는 동안 휴대폰에 설치"를 안내한다.
// 이미 설치 앱·홈 화면 아이콘으로 연 경우엔 보이지 않는다
const noop = () => () => {};
function shouldShow(): boolean {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return !standalone && !isNativeApp();
}

export function InstallNextStep() {
  // 브라우저에서만 판단(서버에서 그릴 때는 숨김)
  const show = useSyncExternalStore(noop, shouldShow, () => false);
  if (!show) return null;
  return (
    <section aria-label="휴대폰에 설치" className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-brand-900">
        <Smartphone className="size-5" aria-hidden /> 기다리는 동안 휴대폰에 설치해 두세요
      </p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-700">
        안드로이드는 설치 앱, 아이폰은 홈 화면 추가로 앱처럼 쓰고 결재·채팅 알림을 받아요. 설치한 뒤 지금과 같은 방법으로 로그인하면 이어져요.
      </p>
      <Link href="/download" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        휴대폰에 설치하기
      </Link>
    </section>
  );
}
