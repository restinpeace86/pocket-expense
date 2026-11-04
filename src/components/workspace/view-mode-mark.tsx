"use client";

import { useEffect } from "react";

// 지금 보는 모드를 쿠키에 남긴다 → 채팅·캘린더가 같은 모드의 틀로 열린다(src/lib/auth/view-mode.ts)
export function ViewModeMark({ companyId, mode }: { companyId: string; mode: "admin" | "employee" }) {
  useEffect(() => {
    document.cookie = `pe_view=${companyId}:${mode}; path=/; max-age=31536000; samesite=lax`;
  }, [companyId, mode]);
  return null;
}
