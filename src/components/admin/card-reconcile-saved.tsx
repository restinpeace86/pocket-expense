"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setCardIssueStatusAction } from "@/app/workspace/[id]/admin/corporate-cards/reconcile/actions";
import { FormError } from "@/components/onboarding/field";
import { inputClass } from "@/components/ui/page-shell";
import { guardAction } from "@/lib/action-guard";
import { KIND_LABEL, STATUS_LABEL, STATUS_OPTIONS, type IssueKind, type IssueStatus, type SavedIssue, type SavedReconcile } from "@/lib/cards/saved";
import { formatWon } from "@/lib/format";

const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const when = (ts: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

// 저장된 카드 대조 결과 (D-154): 요약 + 맞지 않는 건. editable이면(회사 관리자) 건마다 처리·메모를 고른다. 세무사무소는 보기만
export function SavedReconcilePanel({ saved, editable }: { saved: SavedReconcile; editable: boolean }) {
  const [y, m] = saved.month.split("-").map(Number);
  const open = saved.issues.filter((i) => i.status === "open").length;
  const kinds: IssueKind[] = ["missing", "personal", "extra"];
  return (
    <section className={card} aria-label={`${y}년 ${m}월 카드 대조 결과`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">
            {y}년 {m}월 카드 대조 결과
          </h2>
          <p className="break-all text-xs text-zinc-500">
            {saved.file_name ?? "카드 내역"} · {when(saved.updated_at)} {saved.created_by_name ?? ""} 저장 · 짝 맞음 {saved.matched}건{saved.cancelled ? ` · 취소 ${saved.cancelled}건 제외` : ""}
          </p>
        </div>
        {saved.issues.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden /> 모두 맞음
          </span>
        ) : open ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle className="size-3.5" aria-hidden /> 처리 안 된 {open}건
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden /> 모두 처리됨
          </span>
        )}
      </div>
      {kinds.map((k) => {
        const list = saved.issues.filter((i) => i.kind === k);
        if (!list.length) return null;
        return (
          <div key={k} className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-800">
              {KIND_LABEL[k]} ({list.length})
            </h3>
            <ul className="mt-2 flex flex-col divide-y divide-zinc-100">
              {list.map((i) => (
                <IssueRow key={i.id} issue={i} editable={editable} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function IssueRow({ issue: i, editable }: { issue: SavedIssue; editable: boolean }) {
  const [status, setStatus] = useState<IssueStatus>(i.status);
  const [memo, setMemo] = useState(i.memo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = status !== i.status || memo.trim() !== (i.memo ?? "");
  const head = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
      <span className="tabular-nums text-zinc-500">{i.expense_date?.slice(5).replace("-", "/")}</span>
      <span className="min-w-0 flex-1 break-words font-medium">{i.merchant || "(가맹점 없음)"}</span>
      <span className="font-semibold tabular-nums">{i.amount != null ? formatWon(i.amount) : ""}</span>
      {(i.last4 || i.claim_title) && (
        <span className="w-full break-words text-xs text-zinc-500">
          {i.last4 && `카드 끝 ${i.last4}`}
          {i.last4 && i.claim_title && " · "}
          {i.claim_title && `${i.member_name ? `${i.member_name} · ` : ""}${i.claim_title}`}
        </span>
      )}
    </div>
  );
  if (!editable) {
    return (
      <li className="flex flex-col gap-1 py-2.5">
        {head}
        <p className={`text-xs ${i.status === "open" ? "text-red-700" : "text-zinc-600"}`}>
          처리: <b>{STATUS_LABEL[i.status]}</b>
          {i.memo && ` — ${i.memo}`}
        </p>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 py-3">
      {head}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select aria-label={`${i.merchant ?? ""} 처리`} value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)} className={`${inputClass} sm:w-60 ${status === "open" ? "border-red-300" : ""}`}>
          {STATUS_OPTIONS[i.kind].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          aria-label={`${i.merchant ?? ""} 메모`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={300}
          placeholder={status === "tax_review" ? "세무사에게 확인할 내용(필수)" : "메모(선택)"}
          className={`${inputClass} sm:flex-1`}
        />
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => {
            setError(null);
            setNote(null);
            startTransition(async () => {
              const r = await guardAction(() => setCardIssueStatusAction(i.id, status, memo));
              if (!r.ok) return setError(r.error);
              setNote(status === "claim_requested" ? (r.notified ? "저장했어요. 카드 담당 직원에게 알림을 보냈어요." : "저장했어요. (카드 담당 직원이 알림을 켜지 않았거나 담당자가 없어 직접 알려 주세요)") : "저장했어요.");
            });
          }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          저장
        </button>
      </div>
      {i.resolved_by_name && !dirty && i.resolved_at && <p className="text-xs text-zinc-500">{when(i.resolved_at)} {i.resolved_by_name} 처리</p>}
      {note && <p className="text-xs text-emerald-700">{note}</p>}
      <FormError message={error} />
    </li>
  );
}
