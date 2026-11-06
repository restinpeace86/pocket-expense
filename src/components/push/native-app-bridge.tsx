"use client";

import { useEffect } from "react";
import { initNativeAuthReturn, isNativeApp } from "./native";

// 안드로이드 설치 앱(D-230): 모든 화면에서 "크롬 로그인 → 앱으로 돌아옴"을 받는다(로그인 화면 포함). 브라우저에서는 아무것도 안 함
// D-232: 앱은 운영 주소 첫 화면(홍보용 랜딩)으로 열리므로 → 로그인 화면으로(로그인돼 있으면 거기서 바로 내 회사 화면)
export function NativeAppBridge() {
  useEffect(() => {
    if (isNativeApp() && location.pathname === "/") location.replace("/login");
    initNativeAuthReturn();
  }, []);
  return null;
}
