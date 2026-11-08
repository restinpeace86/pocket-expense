"use client";

import { FileText, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideLeaveAction } from "@/app/workspace/[id]/admin/attendance/actions";
import { openProof } from "@/components/attendance/proof-picker";
import { daysLabel } from "@/lib/attendance/leave";
import { kstTime } from "@/lib/attendance/rules";
import { leaveAmountLabel, leaveDateLabel, type Leave } from "@/lib/attendance/vacation";

// 근태 승인 안 휴가 · 휴가 취소 줄(D-241): 증빙 보기 · 증빙 없으면 승인 버튼 대신 안내 · 남은 연차 미리 보기 · 반려 사유 필수
export function LeaveApprovals({ items, dailyHours, done }: { items: Leave[]; dailyHours: number; done: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const [reason, setReason] = useState("");
  const [, start] = useTransition();
  if (!items.length) return null;
  const h = dailyHours;

  const decide = (l: Leave, approve: boolean, why: string | null) =>
    start(async () => {
      setBusy(l.id);
      setError(null);
      const r = await decideLeaveAction(l.id, approve, why);
      setBusy(null);
      if (!r.ok) return setError({ id: l.id, text: r.error ?? "처리하지 못했어요." });
      setRejecting(null);
      setReason("");
      router.refresh();
    });

  return (
    <section aria-label={done ? "처리한 휴가" : "승인 대기 휴가"} className="flex flex-col gap-2">
      <h2 className="text-[15px] font-bold">휴가</h2>
      <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {items.map((l) => {
          const cancel = l.cancel_status === "pending" || (done && l.cancel_status === "approved");
          const needProof = !done && l.status === "pending" && l.proof === "required" && !l.has_proof;
          // used_other = 이 휴가를 뺀 나머지 사용량. 신청: 지금 → 지금 − 이번 / 취소: (지금 − 이번) → 돌려받은 뒤
          const free = l.granted !== null && l.used_other !== null ? l.granted - l.used_other : null;
          const before = free === null ? null : cancel ? free - l.deduct_days : free;
          const after = free === null ? null : cancel ? free : free - l.deduct_days;
          return (
            <li key={l.id} data-leave-row={l.id} data-status={l.cancel_status === "pending" ? "cancel_pending" : l.status} className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 last:border-b-0 md:grid md:grid-cols-[8rem_9rem_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-5">
              <div className="flex items-baseline gap-2 md:block">
                <b className="text-[15px]">{l.member_name}</b>
                {l.member_role !== "employee" && <span className="ml-1 text-xs text-zinc-500">{l.member_role === "admin" ? "관리자" : "대표"}</span>}
                <span className="block text-xs text-zinc-500">{kstTime(l.cancel_requested_at ?? l.created_at)} 신청</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start md:gap-1">
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${cancel ? "bg-indigo-100 text-indigo-800" : "bg-teal-100 text-teal-800"}`}>{cancel ? `휴가 취소 · ${l.type_name}` : `휴가 · ${l.type_name}`}</span>
                <b className="text-sm">{leaveDateLabel(l)}</b>
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <span>
                  {leaveAmountLabel(l, h)}
                  {l.deducts && before !== null && after !== null && !done && (
                    <span className="text-zinc-700">
                      {" "}
                      · 남은 연차 {daysLabel(Math.max(before, 0), h)} → <b className={after < 0 ? "text-red-700" : ""}>{after < 0 ? `−${daysLabel(-after, h)}` : daysLabel(after, h)}</b>
                      {cancel && " (돌려줌)"}
                    </span>
                  )}
                </span>
                {(cancel ? l.cancel_reason : l.reason) && <span className="break-words text-[13px] text-zinc-600">사유 · {cancel ? l.cancel_reason : l.reason}</span>}
                {l.proof !== "none" && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" data-proofs>
                    {l.files.filter((f) => f.path).map((f) => (
                      <button key={f.id} type="button" onClick={() => void openProof(f.path!)} className="flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                        <FileText className="size-4" aria-hidden /> {f.name}
                      </button>
                    ))}
                    {needProof && <span className="font-semibold text-orange-800">증빙 기다리는 중 — 직원이 올리면 승인할 수 있어요</span>}
                  </span>
                )}
                {done && (
                  <span className="text-[13px] text-zinc-700">
                    {l.status === "rejected" ? `반려 · ${l.decided_by_name} · ${l.reject_reason}` : l.cancel_status === "approved" ? `취소 승인 · ${l.cancel_decided_by_name}` : l.self_approved ? "대표 본인 승인" : `승인 · ${l.decided_by_name}`}
                    {l.cancel_status === "rejected" && ` · 취소 반려(${l.cancel_reject_reason})`}
                  </span>
                )}
                {error?.id === l.id && (
                  <span role="alert" className="text-[13px] font-semibold text-red-700">
                    {error.text}
                  </span>
                )}
              </div>
              {!done &&
                (l.can_decide ? (
                  <div className="flex gap-2 md:justify-end">
                    <button type="button" disabled={busy === l.id} onClick={() => (setRejecting(l), setReason(""))} className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 md:flex-none">
                      반려
                    </button>
                    <button type="button" disabled={busy === l.id || needProof} onClick={() => decide(l, true, null)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 md:flex-none" data-approve-leave>
                      {busy === l.id && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      승인
                    </button>
                  </div>
                ) : (
                  <span className="text-[13px] text-zinc-500 md:text-right">{l.mine ? "본인 신청 · 대표가 승인해요" : "관리자 신청 · 대표가 승인해요"}</span>
                ))}
            </li>
          );
        })}
      </ul>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setRejecting(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="leave-reject-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-2.5 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl">
            <div className="flex items-center">
              <h2 id="leave-reject-title" className="text-lg font-bold">
                {rejecting.cancel_status === "pending" ? "취소 신청을 반려할까요?" : "휴가를 반려할까요?"} · {rejecting.member_name}
              </h2>
              <button type="button" onClick={() => setRejecting(null)} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <label htmlFor="leave-reject-reason" className="text-[13px] text-zinc-600">
              반려 사유는 직원에게 그대로 보여요 (필수)
            </label>
            <textarea id="leave-reject-reason" rows={3} maxLength={200} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-zinc-300 px-3 py-2.5 text-[15px] outline-none focus:border-brand-600" />
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="h-11 rounded-xl border border-zinc-300 px-4 text-sm">
                취소
              </button>
              <button type="button" disabled={!reason.trim()} onClick={() => decide(rejecting, false, reason.trim())} className="h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50" data-reject-leave>
                반려하기
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
