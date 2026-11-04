"use client";

import { useSyncExternalStore } from "react";

// 채팅 새 창(PC, D-211): 채팅 목록 위 [새 창으로 열기] → 메신저 크기의 창. 창 이름으로 알아본다(주소가 바뀌어도 그대로).
// 새 창 안에서는 하단 메뉴·[워크스페이스로]·[새 창으로 열기]를 숨겨 채팅만 보인다
export const CHAT_POPUP_NAME = "pe-chat";

const noop = () => () => {};
export function useChatPopup(): boolean {
  return useSyncExternalStore(
    noop,
    () => window.name === CHAT_POPUP_NAME,
    () => false,
  );
}

// 지금 보고 있는 대화방이 있으면 그 방으로 연다. 새 창이 막히면(팝업 차단) 이 창에서 그대로
export function openChatPopup(base: string, pathname: string) {
  const url = pathname.startsWith(`${base}/`) ? pathname : base;
  const w = window.open(url, CHAT_POPUP_NAME, "popup=yes,width=420,height=760");
  if (w) w.focus();
}
