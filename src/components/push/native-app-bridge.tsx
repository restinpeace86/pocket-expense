"use client";

import { useEffect } from "react";
import { initNativeAuthReturn } from "./native";

// 안드로이드 설치 앱(D-230): 모든 화면에서 "크롬 로그인 → 앱으로 돌아옴"을 받는다(로그인 화면 포함). 브라우저에서는 아무것도 안 함
export function NativeAppBridge() {
  useEffect(() => initNativeAuthReturn(), []);
  return null;
}
