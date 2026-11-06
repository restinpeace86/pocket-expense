"use client";

import { useCallback, useEffect, useState } from "react";

// 홈 화면에 추가(D-219, spec/screens/notification-rule.md §0-2)
// 웹사이트는 사용자 몰래 바탕화면 아이콘을 만들 수 없다(브라우저가 막음). 대신
// - 안드로이드 크롬·삼성 인터넷: 브라우저가 주는 '설치 가능' 신호(beforeinstallprompt, layout의 INSTALL_BOOT가 잡아 둠)로
//   우리 버튼 한 번 → 휴대폰 자체의 [홈 화면에 추가] 창 → [추가] 한 번이면 아이콘이 생긴다
// - 신호가 없는 브라우저(아이폰 Safari 등): 메뉴 위치를 짧게 안내
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type W = Window & { __peInstall?: InstallEvent | null; __peInstalled?: boolean };

export type InstallKind = "standalone" | "prompt" | "ios" | "android-manual" | "desktop";

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function detect(): InstallKind {
  const w = window as W;
  if (isStandalone()) return "standalone";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (w.__peInstall) return "prompt";
  if (/Android/.test(ua)) return "android-manual";
  return "desktop";
}

// 홈 화면 아이콘(앱)으로 한 번이라도 연 기기 표시(D-227). 앱과 브라우저 탭은 같은 브라우저 저장소를 써서,
// 나중에 브라우저 탭으로 열어도 "이미 추가함"으로 보고 홈 화면에 추가 안내를 다시 띄우지 않는다
const APP_COOKIE = "pe_app";
function markApp() {
  document.cookie = `${APP_COOKIE}=1; path=/; max-age=${2 * 365 * 86400}; samesite=lax`;
}
function usedApp(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${APP_COOKIE}=`));
}

export function useInstallPrompt() {
  const [kind, setKind] = useState<InstallKind | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const update = () => {
      const k = detect();
      if (k === "standalone") markApp();
      setKind(k);
      setInstalled(!!(window as W).__peInstalled || usedApp());
    };
    update();
    window.addEventListener("pe-install-ready", update);
    return () => window.removeEventListener("pe-install-ready", update);
  }, []);
  // 휴대폰 자체의 [홈 화면에 추가] 창을 띄운다. 추가하면 true
  const install = useCallback(async (): Promise<boolean> => {
    const w = window as W;
    const e = w.__peInstall;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    w.__peInstall = null;
    if (outcome === "accepted") {
      w.__peInstalled = true;
      markApp();
      setInstalled(true);
    }
    setKind(detect());
    return outcome === "accepted";
  }, []);
  return { kind, installed, install };
}
