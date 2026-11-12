"use client";

import { useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { inAppBrowser, openOutsideUrl, type InAppBrowser } from "@/lib/app-download";
import { BRAND } from "@/lib/brand";

// 안드로이드 앱 받기 버튼(D-231). 카카오톡 등 앱 안 브라우저에서는 받아도 설치 화면을 못 열어서
// ("파일 관리자에서 직접 설치"로 끝남) 받기를 기본 브라우저(크롬)로 넘긴다 → 받자마자 [열기] → 설치.
const noop = () => () => {};

export function ApkButton({ apk, version }: { apk: string; version: string }) {
  // 브라우저 정보는 휴대폰에서만 읽는다(서버에서 그릴 때는 null)
  const inApp = useSyncExternalStore<InAppBrowser>(noop, () => inAppBrowser(navigator.userAgent), () => null);
  const cls = "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700";
  if (inApp) {
    return (
      <>
        <a href={openOutsideUrl(apk, inApp)} className={cls} data-inapp={inApp}>
          <Download className="size-4" aria-hidden /> 크롬에서 앱 받기 (v{version})
        </a>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {inApp === "kakaotalk" ? "카카오톡" : "이 앱"} 안에서는 받은 파일을 바로 설치할 수 없어서, 휴대폰 브라우저(크롬)에서 받아요. 받기가 끝나면 아래에 뜨는 <b>[열기]</b>를 누르면 바로 설치 화면이 나와요.
        </p>
      </>
    );
  }
  return (
    <a href={apk} download={`${BRAND.name}.apk`} className={cls}>
      <Download className="size-4" aria-hidden /> 안드로이드 앱 받기 (v{version})
    </a>
  );
}
