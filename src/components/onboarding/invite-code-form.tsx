"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonPrimary, inputClass } from "@/components/ui/page-shell";

// 초대 링크 없이 코드를 직접 입력 (D-003)
export function InviteCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 8) return;
    router.push(`/onboarding/join?code=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={8}
        autoCapitalize="characters"
        className={`${inputClass} text-center font-mono text-lg tracking-[0.3em]`}
        placeholder="초대 코드 8자리"
        aria-label="초대 코드"
      />
      <button type="submit" disabled={code.trim().length !== 8} className={buttonPrimary}>
        회사 확인하기
      </button>
    </form>
  );
}
