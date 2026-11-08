"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { decideAttendanceRequest } from "@/app/workspace/[id]/admin/attendance/actions";
import { dayLabel, minutesLabel } from "@/lib/attendance/month";
import { changeLines, minutesBetween, REASON_MAX } from "@/lib/attendance/request";
import { kstTime } from "@/lib/attendance/rules";
import type { AdminRequest } from "@/lib/attendance/server";
import type { Leave } from "@/lib/attendance/vacation";
import { LeaveApprovals } from "./leave-approvals";

// 근태 승인(spec/features/attendance.md §6-3, D-239): 승인 대기 · 처리 끝(최근 3개월). 반려는 사유 필수
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  return `${day === today ? "오늘" : dayLabel(day).replace(/ \(.\)$/, "")} ${kstTime(d)}`;
}

function Change({ r }: { r: AdminRequest }) {
  const lines = changeLines(r);
  const stay = minutesLabel(minutesBetween(r.new_in, r.new_out));
  if (r.kind === "holiday" && lines[0]?.label === "시각") {
    return (
      <span>
        {r.new_in} – {r.new_out} · {stay} <span className="text-zinc-600">(QR 기록 그대로)</span>
      </span>
    );
  }
  return (
    <span>
      {lines.map((l, i) => (
        <span key={l.label}>
          {i > 0 && " · "}
          {l.label} <s className="text-zinc-500">{l.from}</s> → <b>{l.to}</b>
        </span>
      ))}
      <span className="text-zinc-600"> · 머문 시간 {stay}</span>
    </span>
  );
}

export function AttendanceApprovals({
  tab,
  pending,
  done,
  leavesPending = [],
  leavesDone = [],
  dailyHours = 8,
}: {
  tab: "pending" | "done"; // 탭은 페이지가 그린다(D-242: 오늘 출근 · 승인 대기 · 처리 끝)
  pending: AdminRequest[];
  done: AdminRequest[];
  leavesPending?: Leave[];
  leavesDone?: Leave[];
  dailyHours?: number;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState<AdminRequest | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (!rejecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRejecting(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rejecting]);

  const decide = (r: AdminRequest, approve: boolean, why: string | null) =>
    start(async () => {
      setBusyId(r.id);
      setError(null);
      const res = await decideAttendanceRequest(r.id, approve, why);
      setBusyId(null);
      if (!res.ok) return setError({ id: r.id, text: res.error ?? "처리하지 못했어요." });
      setRejecting(null);
      setReason("");
      router.refresh();
    });

  const list = tab === "pending" ? pending : done;

  return (
    <div className="flex flex-col gap-4">
      <LeaveApprovals items={tab === "pending" ? leavesPending : leavesDone} dailyHours={dailyHours} done={tab === "done"} />
      {(tab === "pending" ? leavesPending : leavesDone).length > 0 && list.length > 0 && <h2 className="-mb-2 text-[15px] font-bold">정정 · 휴일 근무</h2>}
      {list.length === 0 ? (
        (tab === "pending" ? leavesPending : leavesDone).length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">{tab === "pending" ? "승인을 기다리는 신청이 없어요." : "최근 3개월 동안 처리한 신청이 없어요."}</p>
        )
      ) : (
        <ul aria-label={tab === "pending" ? "승인 대기" : "처리 끝"} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {list.map((r) => (
            <li key={r.id} data-request={r.id} data-status={r.status} className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 last:border-b-0 md:grid md:grid-cols-[8rem_7.5rem_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-5">
              <div className="flex items-baseline gap-2 md:block">
                <b className="text-[15px]">{r.member_name}</b>
                {r.member_role !== "employee" && <span className="ml-1 text-xs text-zinc-500">{r.member_role === "admin" ? "관리자" : "대표"}</span>}
                <span className="block text-xs text-zinc-500">{whenLabel(r.created_at)} 신청</span>
              </div>
              <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1">
                <b className="text-sm">{dayLabel(r.work_date)}</b>
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${r.kind === "holiday" ? "bg-red-50 text-red-700" : "bg-indigo-100 text-indigo-800"}`}>{r.kind === "holiday" ? "휴일 근무" : "정정"}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <Change r={r} />
                <span className="break-words text-[13px] text-zinc-600">
                  {r.kind === "holiday" ? "한 일" : "사유"} · {r.reason}
                </span>
                {r.status !== "pending" && (
                  <span className={`text-[13px] ${r.status === "approved" ? "text-green-800" : "text-zinc-700"}`}>
                    {r.status === "approved" ? (r.self_approved ? "대표 본인 승인" : "승인") : "반려"} · {r.decided_by_name} · {r.decided_at ? whenLabel(r.decided_at) : ""}
                    {r.reject_reason && <span className="block">반려 사유 · {r.reject_reason}</span>}
                  </span>
                )}
                {error?.id === r.id && (
                  <span role="alert" className="text-[13px] font-semibold text-red-700">
                    {error.text}
                  </span>
                )}
              </div>
              {r.status === "pending" &&
                (r.can_decide ? (
                  <div className="flex gap-2 md:justify-end">
                    <button type="button" disabled={busyId === r.id} onClick={() => (setRejecting(r), setReason(""))} className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 md:flex-none">
                      반려
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => decide(r, true, null)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-80 md:flex-none" data-approve>
                      {busyId === r.id && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      승인
                    </button>
                  </div>
                ) : (
                  <span className="text-[13px] text-zinc-500 md:text-right">{r.mine ? "본인 신청 · 대표가 승인해요" : "관리자 신청 · 대표가 승인해요"}</span>
                ))}
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-xl bg-zinc-100 px-4 py-3 text-[13px] leading-relaxed text-zinc-700">
        승인하면 그날 기록이 바뀌고 직원에게 [알림]방으로 알려요. <b>원래 기록은 지워지지 않고</b> 직원 화면 그날 상세에 남아요. 휴일 근무는 승인해야 근무한 날로 세요(수당 계산은 하지 않아요).
      </p>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setRejecting(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="reject-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-2.5 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl">
            <div className="flex items-center">
              <h2 id="reject-title" className="text-lg font-bold">
                반려할까요? · {rejecting.member_name} {dayLabel(rejecting.work_date)}
              </h2>
              <button type="button" onClick={() => setRejecting(null)} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <label htmlFor="reject-reason" className="text-[13px] text-zinc-600">
              반려 사유는 직원에게 그대로 보여요 (필수)
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2.5 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              placeholder="예: 그날은 연차로 처리할 예정이에요. 휴가 신청으로 올려 주세요."
            />
            {error?.id === rejecting.id && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error.text}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="h-11 rounded-xl border border-zinc-300 px-4 text-sm text-zinc-800 hover:bg-zinc-50">
                취소
              </button>
              <button
                type="button"
                disabled={!reason.trim() || busyId === rejecting.id}
                onClick={() => decide(rejecting, false, reason.trim())}
                className="flex h-11 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                data-reject-confirm
              >
                {busyId === rejecting.id && <Loader2 className="size-4 animate-spin" aria-hidden />}
                반려하기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
