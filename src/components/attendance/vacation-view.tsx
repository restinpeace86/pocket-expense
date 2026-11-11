"use client";

import { LeaveDocButtons } from "@/components/company-forms/leave-doc-buttons";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cancelLeaveAction, removeLeaveFileAction } from "@/app/workspace/[id]/employee/vacation/actions";
import { daysLabel } from "@/lib/attendance/leave";
import { leaveAmountLabel, leaveBadge, leaveDateLabel, PROOF_MAX_FILES, yearSummary, type Leave, type VacationData } from "@/lib/attendance/vacation";
import type { ProcessedProof } from "@/lib/attendance/proof-image";
import { kstTime } from "@/lib/attendance/rules";
import { openProof, ProofPicker, uploadProofs } from "./proof-picker";

// 직원 [휴가](spec/features/attendance.md §8-2, D-241): 남은 연차 · [휴가 신청] · 내역 · 누르면 상세(취소 · 취소 신청 · 증빙)
const FLASH: Record<string, string> = {
  pending: "휴가 신청을 보냈어요. 관리자가 처리하면 [알림]방으로 알려 드려요.",
  proof: "신청을 보냈어요. 증빙을 올리면 관리자가 승인할 수 있어요.",
  self: "대표 본인 신청이라 바로 승인됐어요.",
  canceled: "휴가를 취소했어요.",
  cancel_pending: "취소 신청을 보냈어요. 승인되면 연차를 돌려받아요.",
};

export function VacationView({ data, base, companyId, memberId, flash }: { data: VacationData; base: string; companyId: string; memberId: string; flash: string | null }) {
  const h = data.settings.daily_hours;
  const s = yearSummary(data);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data.leaves.find((l) => l.id === openId) ?? null;
  const currentYear = Number(data.today.slice(0, 4));
  const pct = s.grant && s.grant.granted > 0 ? Math.min(100, Math.max(0, ((s.remaining ?? 0) / s.grant.granted) * 100)) : 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-3xl md:px-6 md:pt-6">
      <div className="flex items-center gap-1">
        <Link href={base} aria-label="홈으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">휴가 및 근태 신청</h1>
        <div className="ml-auto flex items-center">
          <Link href={`${base}/vacation?year=${data.year - 1}`} aria-label="이전 해" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
            <ChevronLeft className="size-5" />
          </Link>
          <b className="min-w-16 text-center text-[17px]">{data.year}년</b>
          {data.year <= currentYear ? (
            <Link href={`${base}/vacation?year=${data.year + 1}`} aria-label="다음 해" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span aria-hidden className="flex size-11 items-center justify-center text-zinc-300">
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      </div>

      {flash && FLASH[flash] && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 px-3.5 py-3 text-sm text-green-900" data-flash={flash}>
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {FLASH[flash]}
        </p>
      )}

      <section aria-label="남은 연차" className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 md:px-5" data-balance>
        {s.grant ? (
          <>
            <p className="text-[13px] text-zinc-600">남은 연차</p>
            <b className={`block text-3xl ${(s.remaining ?? 0) < 0 ? "text-red-700" : ""}`}>{(s.remaining ?? 0) < 0 ? `−${daysLabel(-(s.remaining ?? 0), h)}` : daysLabel(s.remaining ?? 0, h)}</b>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-[13px] text-zinc-700">
              <span>받은 {daysLabel(s.grant.granted, h)}</span>
              <span>쓴 {daysLabel(s.grant.approved, h)}</span>
              <span>승인 대기 {daysLabel(s.pending, h)}(미리 뺐어요)</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600">
              쓸 수 있는 기간 {s.grant.period_start} ~ {s.grant.period_end} · 회사가 확정한 일수예요
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-zinc-700">
            <b>회사가 아직 연차를 확정하지 않았어요.</b>
            <br />
            연차는 확정된 뒤에 신청할 수 있어요. 경조사·병가처럼 연차에서 빠지지 않는 휴가는 지금도 신청할 수 있어요.
          </p>
        )}
      </section>

      <Link href={`${base}/vacation/new`} className="flex h-13 items-center justify-center rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700" data-new-vacation>
        휴가 신청
      </Link>

      {data.leaves.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">{data.year}년 휴가 내역이 없어요.</p>
      ) : (
        <ul aria-label="휴가 내역" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {data.leaves.map((l) => {
            const b = leaveBadge(l);
            return (
              <li key={l.id} className="border-b border-zinc-100 last:border-b-0">
                <button type="button" onClick={() => setOpenId(l.id)} data-leave={l.id} data-badge={b.key} className="flex min-h-14 w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-zinc-50">
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm">{leaveDateLabel(l)}</b>
                    <span className="block text-[13px] text-zinc-700">
                      {l.type_name} · {leaveAmountLabel(l, h)}
                    </span>
                    {l.status === "rejected" && l.reject_reason && <span className="block truncate text-xs text-zinc-600">반려 사유: {l.reject_reason}</span>}
                  </span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-zinc-600">승인 전에는 바로 취소할 수 있고, 승인된 휴가는 취소 신청을 해요(승인되면 연차를 돌려받아요). 지난 날짜는 이번 달까지만 신청·취소할 수 있어요.</p>

      {open && <LeaveSheet leave={open} h={h} today={data.today} base={base} companyId={companyId} memberId={memberId} onClose={() => setOpenId(null)} />}
    </main>
  );
}

function LeaveSheet({ leave: l, h, today, base, companyId, memberId, onClose }: { leave: Leave; h: number; today: string; base: string; companyId: string; memberId: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [files, setFiles] = useState<ProcessedProof[]>([]);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const b = leaveBadge(l);
  const monthStart = `${today.slice(0, 7)}-01`;
  const canCancelNow = l.status === "pending";
  const canAskCancel = l.status === "approved" && l.cancel_status !== "pending" && l.end_date >= monthStart;
  const liveFiles = l.files.filter((f) => !f.purged);
  const canAddProof = l.proof !== "none" && (l.status === "pending" || l.status === "approved") && liveFiles.length < PROOF_MAX_FILES;

  const done = (flash: string) => {
    router.replace(`${base}/vacation?year=${l.start_date.slice(0, 4)}${flash ? `&done=${flash}` : ""}`);
    router.refresh();
  };
  const cancel = () =>
    start(async () => {
      setError(null);
      const r = await cancelLeaveAction(l.id, reason.trim() || null);
      if (!r.ok) return setError(r.error);
      onClose();
      done(r.result === "canceled" ? "canceled" : "cancel_pending");
    });
  const upload = () =>
    start(async () => {
      setError(null);
      if (!files.length) return setError("증빙 파일을 골라 주세요.");
      if (!consent) return setError("민감정보 수집·이용에 동의해 주세요.");
      const failed = await uploadProofs(companyId, memberId, l.id, files, consent);
      if (failed.length) setError(`올리지 못한 파일: ${failed.join(", ")}`);
      setFiles([]);
      router.refresh();
    });
  const remove = (fileId: string) =>
    start(async () => {
      const r = await removeLeaveFileAction(fileId);
      if (!r.ok) setError(r.error ?? null);
      router.refresh();
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="leave-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-4 md:rounded-3xl md:pb-6">
        <div className="flex items-center gap-2">
          <h2 id="leave-title" className="text-lg font-bold">
            {l.type_name}
          </h2>
          <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-[15px]">
          <dt className="text-zinc-600">날짜</dt>
          <dd>{leaveDateLabel(l)}</dd>
          <dt className="text-zinc-600">일수</dt>
          <dd>{leaveAmountLabel(l, h)}</dd>
          {l.reason && (
            <>
              <dt className="text-zinc-600">사유</dt>
              <dd className="break-words">{l.reason}</dd>
            </>
          )}
          <dt className="text-zinc-600">신청</dt>
          <dd>{kstTime(l.created_at)}</dd>
          {l.decided_at && l.status !== "pending" && (
            <>
              <dt className="text-zinc-600">처리</dt>
              <dd>
                {l.self_approved ? "대표 본인 승인" : `${l.status === "rejected" ? "반려" : l.status === "canceled" && !l.cancel_status ? "취소" : "승인"} · ${l.decided_by_name ?? ""}`}
              </dd>
            </>
          )}
        </dl>
        {l.form_id && <LeaveDocButtons leaveId={l.id} />}
        {l.reject_reason && <p className="rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13px] text-zinc-800">반려 사유: {l.reject_reason}</p>}
        {l.cancel_status === "pending" && <p className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-[13px] text-indigo-900">취소 신청 중이에요{l.cancel_reason ? ` · 사유: ${l.cancel_reason}` : ""}. 승인되면 연차를 돌려받아요.</p>}
        {l.cancel_status === "rejected" && <p className="rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13px] text-zinc-800">취소 신청이 반려됐어요 · {l.cancel_reject_reason}</p>}

        {l.proof !== "none" && (
          <section aria-label="증빙" className="flex flex-col gap-2 rounded-xl border border-zinc-200 px-3.5 py-3" data-leave-proofs>
            <b className="text-sm">증빙 {l.proof === "required" && <span className="font-normal text-zinc-600">(필수)</span>}</b>
            {l.files.length === 0 && <p className="text-[13px] text-orange-800">아직 증빙이 없어요. {l.status === "pending" && "올려야 관리자가 승인할 수 있어요."}</p>}
            {l.files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-[13px]">
                <FileText className="size-4 shrink-0 text-zinc-500" aria-hidden />
                {f.purged || !f.path ? (
                  <span className="text-zinc-500">{f.name} · 보관 기간(3년)이 지나 지워졌어요</span>
                ) : (
                  <button type="button" onClick={() => void openProof(f.path!)} className="min-w-0 truncate text-left font-semibold text-brand-700 hover:underline">
                    {f.name}
                  </button>
                )}
                {l.status === "pending" && !f.purged && (
                  <button type="button" onClick={() => remove(f.id)} disabled={busy} className="ml-auto h-9 shrink-0 rounded-lg px-2 text-zinc-600 hover:bg-zinc-100">
                    빼기
                  </button>
                )}
              </div>
            ))}
            {canAddProof && (
              <>
                <ProofPicker files={files} onChange={setFiles} consent={consent} onConsent={setConsent} max={PROOF_MAX_FILES - liveFiles.length} required={false} />
                {files.length > 0 && (
                  <button type="button" onClick={upload} disabled={busy} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-upload-proof>
                    {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    증빙 올리기
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {canCancelNow && (
          <button type="button" onClick={cancel} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-70" data-cancel-leave>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            신청 취소
          </button>
        )}
        {canAskCancel &&
          (asking ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="cancel-reason" className="text-sm font-semibold">
                취소 사유 <span className="font-normal text-zinc-500">(선택)</span>
              </label>
              <textarea id="cancel-reason" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-zinc-300 px-3 py-2.5 text-[15px] outline-none focus:border-brand-600" />
              <button type="button" onClick={cancel} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-ask-cancel>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                취소 신청 보내기
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 font-semibold text-zinc-800 hover:bg-zinc-50" data-open-cancel>
              취소 신청
            </button>
          ))}
      </section>
    </div>
  );
}
