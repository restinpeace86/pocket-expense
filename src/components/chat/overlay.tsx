"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// 채팅 안의 창(사람 고르기·메시지 메뉴·사진 보기·대화상대)은 화면 맨 위층(body)에 띄운다(D-207).
// 채팅 틀은 휴대폰 키보드 때문에 위치를 옮기는(transform) 상자라, 그 안에 두면 직원 하단 메뉴보다 아래에 깔린다.
// data-keyboard-self: 키보드 처리는 채팅 틀과 같게(keyboard-aware.tsx)
export function ChatOverlay({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div data-keyboard-self>{children}</div>, document.body);
}
