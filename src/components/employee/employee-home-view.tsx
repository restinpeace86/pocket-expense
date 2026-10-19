"use client";

import { AlertCircle, Camera, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createDraftClaimAction, loadMoreMyClaimsAction } from "@/app/workspace/[id]/employee/actions";
import { CATEGORY_LABEL, type ExpenseCategory } from "@/lib/expense/categories";
import { CLAIM_FILTERS, claimStatusBadge, shiftMonth, type ClaimFilterKey } from "@/lib/expense/status";
import type { EmployeeSummary, MyClaimRow } from "@/lib/employee/types";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

// 화면 E-01 직원 메인 (spec/screens/worker-dashboard.md)
const CATEGORY_ICON: Record<ExpenseCategory, string> = { meal: "🍚", trip: "🧳", meeting: "🤝", purchase: "📦" };

function dot(d: string) {
  return d.replaceAll("-", ".");
}

function dateSummary(c: MyClaimRow) {
  if (!c.dateFrom || !c.dateTo) return `작성 ${dot(c.created_at.slice(0, 10))}`;
  if (c.dateFrom === c.dateTo) return dot(c.dateFrom);
  return `${dot(c.dateFrom)}~${dot(c.dateTo).slice(5)}`;
}

function paymentSummary(c: MyClaimRow) {
  if (c.corporateCount && c.personalCount) return `법인 ${c.corporateCount} · 사비 ${c.personalCount}`;
  if (c.corporateCount) return "법인카드";
  if (c.personalCount) return "사비";
  return null;
}

function categoryTag(c: MyClaimRow) {
  if (c.is_business_trip) return `${CATEGORY_ICON.trip} 출장`;
  const cats = c.categories as ExpenseCategory[];
  if (cats.length === 0) return null;
  if (cats.length === 1) return `${CATEGORY_ICON[cats[0]]} ${CATEGORY_LABEL[cats[0]]}`;
  return cats.map((k) => CATEGORY_ICON[k]).join("");
}

function ClaimCard({ claim, base, onRejected }: { claim: MyClaimRow; base: string; onRejected: (c: MyClaimRow) => void }) {
  const badge = claimStatusBadge(claim.status, claim.settlement_required);
  const editable = claim.status === "draft" || claim.status === "rejected";
  const href = editable ? `${base}/claims/${claim.id}/edit` : `${base}/claims/${claim.id}`;
  const tag = categoryTag(claim);
  const pay = paymentSummary(claim);
  const cardClass = "block w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-brand-300 active:bg-zinc-50";
  const body = (
    <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {tag && <p className="text-xs font-medium text-zinc-500">{tag}</p>}
            <p className="break-keep font-semibold text-zinc-900 [overflow-wrap:anywhere]">{claim.title || "제목 없는 소명서"}</p>
          </div>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{[dateSummary(claim), pay, `영수증 ${claim.item_count}장`].filter(Boolean).join("  ·  ")}</p>
        <p className="mt-1 text-lg font-bold text-zinc-900">{formatWon(claim.total_amount)}</p>
    </>
  );
  return (
    <li>
      {/* 반려 건은 먼저 사유를 보여 준다 (worker-dashboard.md §4) */}
      {claim.status === "rejected" ? (
        <button type="button" onClick={() => onRejected(claim)} className={cardClass}>
          {body}
        </button>
      ) : (
        <Link href={href} className={cardClass}>
          {body}
        </Link>
      )}
    </li>
  );
}

function RejectedSheet({ claim, base, onClose }: { claim: MyClaimRow; base: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-labelledby="rejected-title">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">🔴 반려됨{claim.rejected_at ? ` · ${dot(claim.rejected_at.slice(0, 10))}` : ""}</p>
            <h2 id="rejected-title" className="break-keep font-semibold [overflow-wrap:anywhere]">
              {claim.title || "제목 없는 소명서"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-700">반려 사유</p>
        <p className="mt-1 whitespace-pre-wrap rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{claim.rejection_reason || "사유가 적혀 있지 않아요. 관리자에게 확인해 주세요."}</p>
        <Link
          href={`${base}/claims/${claim.id}/edit`}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-base font-semibold text-white hover:bg-brand-700"
        >
          수정 후 재상신하기
        </Link>
      </div>
    </div>
  );
}

export function EmployeeHomeView({
  name,
  base,
  month,
  thisMonth,
  filter,
  summary,
  creditsBlocked,
  initial,
  initialSheet,
}: {
  name: string;
  base: string;
  month: string;
  thisMonth: string;
  filter: ClaimFilterKey;
  summary: EmployeeSummary;
  creditsBlocked: boolean; // 회사 무료 사용량을 다 썼고 이벤트도 꺼져 있음 (D-046, D-054)
  initial: { items: MyClaimRow[]; nextCursor: string | null };
  initialSheet?: MyClaimRow; // 미리보기 전용: 반려 사유 시트를 연 상태로 그린다
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [loading, startLoad] = useTransition();
  const [rejected, setRejected] = useState<MyClaimRow | null>(initialSheet ?? null);

  const q = (m: string, f: ClaimFilterKey) => {
    const p = new URLSearchParams();
    if (m !== thisMonth) p.set("month", m);
    if (f !== "all") p.set("status", f);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const [y, mm] = month.split("-");

  const create = () =>
    startCreate(async () => {
      setError(null);
      const res = await measureAction("employee.create_claim", () => createDraftClaimAction());
      if (res && "error" in res) setError(res.error);
    });

  const loadMore = () =>
    startLoad(async () => {
      if (!cursor) return;
      const page = await measureAction("employee.load_more_claims", () => loadMoreMyClaimsAction(month, filter, cursor));
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-28 pt-5">
      <h1 className="text-xl font-bold tracking-tight">안녕하세요, {name}님 👋</h1>

      <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
        <p className="text-sm text-white/85">사비 정산 대기금</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatWon(summary.pending_payout)}</p>
        <p className="mt-1 text-xs text-white/80">승인됐지만 아직 입금되지 않은 내 돈이에요.</p>
      </section>

      {summary.rejected_count > 0 && (
        <Link href={q(month, "rejected")} className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span className="flex-1">반려된 소명서 {summary.rejected_count}건 — 수정이 필요해요</span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">내 지출소명서</h2>
          <div className="flex items-center">
            <Link href={q(shiftMonth(month, -1), filter)} aria-label="이전 달" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
              <ChevronLeft className="size-5" />
            </Link>
            <span className="min-w-20 text-center text-sm font-medium">
              {y}년 {Number(mm)}월
            </span>
            {month < thisMonth ? (
              <Link href={q(shiftMonth(month, 1), filter)} aria-label="다음 달" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
                <ChevronRight className="size-5" />
              </Link>
            ) : (
              <span className="inline-flex size-11 items-center justify-center text-zinc-300" aria-hidden>
                <ChevronRight className="size-5" />
              </span>
            )}
          </div>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="상태 필터">
          {CLAIM_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={q(month, f.key)}
              aria-current={filter === f.key ? "true" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm ${filter === f.key ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
            {filter === "all" ? "이 달에 올린 지출소명서가 없어요." : "해당 상태의 지출소명서가 없어요."}
            <br />
            {!creditsBlocked && "아래 버튼으로 영수증을 찍어 올려 보세요."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((c) => (
              <ClaimCard key={c.id} claim={c} base={base} onRejected={setRejected} />
            ))}
          </ul>
        )}
        {cursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}더 보기
          </button>
        )}
      </section>

      {rejected && <RejectedSheet claim={rejected} base={base} onClose={() => setRejected(null)} />}

      {/* 하단 고정 CTA: 하단 메뉴 바로 위 (worker-dashboard.md §3) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 bg-gradient-to-t from-page via-page/95 to-transparent px-4 pb-3 pt-6">
        <div className="pointer-events-auto mx-auto max-w-md">
          {error && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {creditsBlocked ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">회사 무료 사용량을 모두 사용했습니다. 관리자에게 문의하세요.</p>
          ) : (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-base font-semibold text-white shadow-lg hover:bg-brand-700 disabled:opacity-70"
            >
              {creating ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
              영수증 찍고 지출 올리기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
