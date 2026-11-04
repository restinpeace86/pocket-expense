"use client";

import { useEffect, useSyncExternalStore } from "react";

// 관리자 모드 / 직원 모드(D-049·D-207). 지금 보는 모드를 쿠키 pe_view에 남기고(화면이 실제로 열릴 때만 — 미리 불러오기 요청은 모드를 바꾸지 않게),
// 채팅·캘린더처럼 두 모드가 같은 주소를 쓰는 화면은 브라우저에서 이 값을 읽어 틀(하단 메뉴·왼쪽 메뉴)을 고른다.
// (서버에서만 고르면 화면 전환 캐시에 앞 모드의 틀이 남아 직원 모드인데도 하단 메뉴가 빠지는 일이 있었다)
const EVENT = "pe-view-change";

function readMode(companyId: string): "admin" | "employee" | null {
  const m = /(?:^|;\s*)pe_view=([^;]*)/.exec(document.cookie);
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v === `${companyId}:employee` ? "employee" : v === `${companyId}:admin` ? "admin" : null;
}

export function ViewModeMark({ companyId, mode }: { companyId: string; mode: "admin" | "employee" }) {
  useEffect(() => {
    if (readMode(companyId) === mode) return;
    document.cookie = `pe_view=${companyId}:${mode}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
  }, [companyId, mode]);
  return null;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

// 관리자 계정이면 쿠키의 모드, 직원은 늘 직원 모드. 서버에서 그릴 때는 serverMode(쿠키로 정한 값)
export function useViewMode(companyId: string, isAdmin: boolean, serverMode: "admin" | "employee"): "admin" | "employee" {
  return useSyncExternalStore(
    subscribe,
    () => (isAdmin ? (readMode(companyId) ?? "admin") : "employee"),
    () => serverMode,
  );
}
