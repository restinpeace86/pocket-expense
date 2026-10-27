"use client";

import { CATEGORY_LABEL, CONDOLENCE_TARGET_LABEL } from "@/lib/expense/categories";
import { ReceiptGallery } from "./receipt-gallery";
import { ExceptionNote } from "./exception-note";
import { ClaimPdfButton } from "./claim-pdf-button";
import { ArrowLeft, Check, ChevronRight, Images, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveClaimAction, overrideAccountTitleAction, rejectClaimAction } from "@/lib/claims/actions";
import { formatDateTimeKst } from "@/lib/claims/format";
import type { ClaimDetail } from "@/lib/claims/types";
import { claimStatusBadge } from "@/lib/expense/status";
import { formatWon } from "@/lib/format";
import { guardAction } from "@/lib/action-guard";
import { measureAction } from "@/lib/perf/client";
import { ClaimItems, type AccountTitleOption } from "./claim-items";

// 지출 승인 관리 오른쪽 상세 (admin-expense-approvals.md §4.C·D). 사전 검토자 결재 화면(approver.md ①)도 같은 화면을 쓴다
export function AdminClaimDetail({
  detail,
  canAct,
  blockedReason,
  backHref,
  payoutsHref,
  timeline,
  reviewer = false,
  accountTitles,
  next = null,
}: {
  detail: ClaimDetail;
  canAct: boolean;
  blockedReason: string | null;
  backHref: string;
  payoutsHref: string;
  timeline: React.ReactNode;
  reviewer?: boolean; // 사전 검토자: [검토 승인], 마감 요약·계정과목 없음, 직원 화면 틀(왼쪽 메뉴 없음)
  accountTitles?: AccountTitleOption[]; // 관리자: 항목별 계정과목 조정 (T11-3)
  next?: { href: string; count: number } | null; // 처리 뒤 [다음 결재 n건 보기] (approver.md ① 완료 화면)
}) {
  const { claim, owner } = detail;
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [reason, setReason] = useState("");
  const [flagged, setFlagged] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [done, setDone] = useState(false); // 승인·반려를 마친 뒤 완료 안내 + 다음 결재
  const [gallery, setGallery] = useState(false);
  // 계정과목은 고르는 즉시 화면에 반영하고(낙관적 갱신) 저장은 뒤에서 한다. 실패하면 원래대로 되돌린다
  const [accounts, setAccounts] = useState<Record<string, { id: string | null; name: string | null; code: string | null; overridden: boolean }>>({});
  const items = detail.items.map((i) =>
    accounts[i.id] ? { ...i, account_title_id: accounts[i.id].id, account_title_name: accounts[i.id].name, account_title_code: accounts[i.id].code, account_title_overridden: accounts[i.id].overridden } : i,
  );
  const changeAccount = async (itemId: string, titleId: string | null) => {
    const before = accounts[itemId];
    const t = titleId ? accountTitles?.find((x) => x.id === titleId) : null;
    if (t) setAccounts((a) => ({ ...a, [itemId]: { id: t.id, name: t.name, code: t.code, overridden: true } }));
    setAccountBusy(itemId);
    const res = await guardAction(() => measureAction("admin.override_account_title", () => overrideAccountTitleAction(itemId, titleId)));
    setAccountBusy(null);
    if (!res.ok) {
      setAccounts((a) => {
        const n = { ...a };
        if (before) n[itemId] = before;
        else delete n[itemId];
        return n;
      });
      setMessage({ kind: "error", text: res.error });
      return;
    }
    setAccounts((a) => ({ ...a, [itemId]: res.account }));
  };
  const badge = claimStatusBadge(claim.status, claim.settlement_required);
  const lastReject = [...detail.approvals].reverse().find((a) => a.status === "rejected");

  const approve = () =>
    start(async () => {
      setMessage(null);
      const res = await guardAction(() => measureAction("admin.approve_claim", () => approveClaimAction(claim.id)));
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setMessage({
        kind: "ok",
        text: res.status === "submitted" ? "검토 승인했어요. 다음 결재자에게 전달됩니다." : res.status === "paid" ? "승인했어요. 정산할 금액이 없어 바로 완료됐어요." : "승인했어요. 정산 지급 관리에서 지급 완료 처리를 해 주세요.",
      });
      setDone(true);
      router.refresh();
    });
  const reject = () =>
    start(async () => {
      setMessage(null);
      const res = await guardAction(() => measureAction("admin.reject_claim", () => rejectClaimAction(claim.id, reason, flagged)));
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setMode("view");
      setMessage({ kind: "ok", text: "반려했어요. 청구자에게 사유가 전달됩니다. 직원이 고쳐서 다시 올리면 승인 대기로 돌아와요." });
      setDone(true);
      router.refresh();
    });

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-28">
      <div className="flex items-center justify-between gap-2">
        <Link href={backHref} className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm text-zinc-600 hover:bg-zinc-100 ${reviewer ? "" : "lg:hidden"}`}>
          <ArrowLeft className="size-4" />
          목록
        </Link>
        <span className={`ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{claim.self_approved ? "결재 생략" : badge.label}</span>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h1 className="break-keep text-xl font-bold [overflow-wrap:anywhere]">{claim.title || "제목 없는 결의서"}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          신청자: {owner.name}
          {owner.department && ` (${owner.department})`}
          {owner.position && ` · ${owner.position}`} · 상신 {formatDateTimeKst(claim.submitted_at)}
        </p>
        {(claim.category || claim.vehicle) && (
          <p className="mt-2 text-sm text-zinc-700">
            {claim.category && `📂 ${CATEGORY_LABEL[claim.category]}`}
            {claim.category === "condolence" && (claim.condolence_target === "internal" || claim.condolence_target === "external") && ` · ${CONDOLENCE_TARGET_LABEL[claim.condolence_target]}${claim.condolence_target === "external" && claim.client_name ? ` (${claim.client_name})` : ""}`}
            {claim.vehicle && ` · 🚙 ${claim.vehicle.nickname} (${claim.vehicle.plate_number})`}
          </p>
        )}
        {claim.is_business_trip && (
          <p className="mt-2 text-sm text-zinc-700">
            🧳 출장지·기간·목적: {claim.trip_destination} / {claim.trip_start_date?.replaceAll("-", ".")}~{claim.trip_end_date?.slice(5).replace("-", ".")} / {claim.trip_purpose}
          </p>
        )}
        {claim.description && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">지출 사유: {claim.description}</p>}
        <ExceptionNote memo={claim.exception_memo} items={detail.items} />
        {claim.status === "submitted" && claim.current_round > 1 && lastReject && (
          <p className="mt-2 text-sm text-red-700">
            이전 회차 반려 사유: {lastReject.comment} ({formatDateTimeKst(lastReject.acted_at)})
          </p>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            포함된 영수증 {detail.items.length}건{mode === "reject" && <span className="ml-2 text-sm font-normal text-red-700">문제 있는 영수증을 체크해 주세요(선택)</span>}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* 회사 양식으로 결의서 PDF(관리자, D-118) */}
            {!reviewer && detail.items.length > 0 && <ClaimPdfButton claimId={claim.id} />}
            {detail.items.length > 0 && (
              <button type="button" onClick={() => setGallery(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50">
                <Images className="size-4" /> 영수증 모아보기
              </button>
            )}
          </div>
        </div>
        {gallery && <ReceiptGallery claimId={claim.id} items={items} onClose={() => setGallery(false)} />}
        <ClaimItems
          items={items}
          cards={detail.cards}
          flaggedIds={claim.status === "rejected" ? detail.flaggedItemIds : []}
          selectable={mode === "reject"}
          selected={flagged}
          onToggle={(id) => setFlagged((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))}
          accountTitles={reviewer ? undefined : accountTitles}
          onAccountChange={reviewer || !accountTitles ? undefined : changeAccount}
          accountBusyId={accountBusy}
        />
      </section>

      {!reviewer && (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">마감 요약</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
          <dt className="text-zinc-600">세무 증빙 총지출액 (영수증 금액 합계)</dt>
          <dd className="text-right font-semibold tabular-nums">{formatWon(claim.total_amount)}</dd>
          <dt className="text-zinc-600">회사 통장 실지출 (직원 사비 지급액)</dt>
          <dd className="text-right tabular-nums">{formatWon(detail.payout)}</dd>
          <dt className="text-zinc-600">직원 납부액 (법인카드 개인 부담)</dt>
          <dd className="text-right tabular-nums">{formatWon(detail.payback)}</dd>
        </dl>
        {claim.status === "approved" && (
          <Link href={payoutsHref} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-zinc-100 px-3 font-medium hover:bg-zinc-200">
            정산 지급 관리로 이동 →
          </Link>
        )}
      </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">결재 이력</h2>
        {timeline}
      </section>

      {(canAct || blockedReason || message || done) && (
        <div className={`kb-hide fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur ${reviewer ? "" : "md:left-64"}`}>
          <div className="mx-auto flex max-w-5xl flex-col gap-2">
            {message && (
              <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role={message.kind === "error" ? "alert" : "status"}>
                {message.text}
              </p>
            )}
            {done && message?.kind === "ok" && (
              <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:w-96">
                <Link href={backHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white font-medium">
                  목록으로
                </Link>
                {next && next.count > 0 ? (
                  <Link href={next.href} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700">
                    다음 결재 {next.count}건 보기 <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <span className="inline-flex min-h-12 items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-600">남은 결재가 없어요</span>
                )}
              </div>
            )}
            {!done && !canAct && blockedReason && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">{blockedReason}</p>}
            {canAct && !done && mode === "view" && (
              <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:w-96">
                <button type="button" disabled={pending} onClick={() => setMode("reject")} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                  <X className="size-4" />
                  {reviewer ? "반려" : "결의서 반려"}
                </button>
                <button type="button" disabled={pending} onClick={approve} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {reviewer ? "검토 승인" : "일괄 승인"}
                </button>
              </div>
            )}
            {canAct && !done && mode === "reject" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="reject-reason">
                  반려 사유<span className="text-red-600">*</span> <span className="font-normal text-zinc-500">(5자 이상, 직원에게 그대로 보여요)</span>
                </label>
                <textarea
                  id="reject-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 2번 영수증 금액이 카드 내역과 달라요. 카드 승인 내역을 함께 올려 주세요."
                  className="min-h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:w-96">
                  <button type="button" onClick={() => setMode("view")} className="min-h-12 rounded-xl border border-zinc-300 bg-white font-medium">
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={pending || reason.trim().length < 5}
                    onClick={reject}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-50"
                  >
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    반려하기{flagged.length > 0 && ` (지목 ${flagged.length}건)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
