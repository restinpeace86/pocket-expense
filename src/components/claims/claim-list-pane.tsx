"use client";

import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

// 지출 승인 관리 왼쪽 목록 칸(admin-expense-approvals.md §2, T3-1b)
// - PC(lg 이상): 화면에 붙은 채 따로 스크롤 → 상세를 봐도 목록 위치가 그대로. 고른 결의서는 목록 안에서 보이게 맞춘다
// - 휴대폰: 목록 → 상세 2단계(목록 칸은 상세 화면에서 숨김). 상세에서 돌아오면 보던 결의서(#c-id)로 스크롤
export function ClaimListPane({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // 휴대폰: 상세에서 [목록]으로 돌아오면(#c-id) 목록이 그려진 뒤 그 결의서로 — 목록은 나중에 그려져 브라우저 기본 이동이 놓친다
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith("c-")) return;
    const row = document.getElementById(id);
    row?.scrollIntoView({ block: "center" });
    // 보던 결의서를 잠깐 강조
    const link = row?.querySelector<HTMLElement>("a");
    if (!link) return;
    link.style.boxShadow = "0 0 0 3px rgb(99 102 241 / 0.45)";
    const t = setTimeout(() => (link.style.boxShadow = ""), 2500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-claim-row][aria-current="true"]');
    const pane = ref.current;
    if (!el || !pane || pane.scrollHeight <= pane.clientHeight) return;
    const top = el.offsetTop - pane.offsetTop;
    if (top < pane.scrollTop || top + el.offsetHeight > pane.scrollTop + pane.clientHeight) pane.scrollTop = top - pane.clientHeight / 3;
  });
  return (
    <div ref={ref} className={`flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 ${className}`} data-testid="claim-list-pane">
      {children}
    </div>
  );
}

// 누른 결의서를 여는 중 표시(서버에서 상세를 받는 동안)
export function RowPending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-4 shrink-0 animate-spin text-brand-600" aria-label="여는 중" /> : null;
}
