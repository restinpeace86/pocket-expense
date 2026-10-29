"use client";

import { MessageSquareMore } from "lucide-react";
import { useState, useTransition } from "react";
import { createTaxRequestAction, setTaxRequestStatusAction } from "@/app/tax-office/[companyId]/request-actions";
import { answerTaxRequestAction } from "@/app/workspace/[id]/admin/export/actions";
import { thrownActionMessage } from "@/lib/action-guard";
import { formatDateTimeKst } from "@/lib/claims/format";
import type { TaxRequest } from "@/lib/tax-office/requests";
import { inputClass } from "@/components/ui/page-shell";

const STATUS: Record<TaxRequest["status"], [string, string]> = {
  open: ["답변 기다림", "bg-amber-50 text-amber-800"],
  answered: ["회사 답변", "bg-blue-50 text-blue-700"],
  resolved: ["해결", "bg-emerald-50 text-emerald-700"],
};
const monthLabel = (m: string) => `${Number(m.slice(5, 7))}월`;

// 세무사무소 → 회사 자료 요청 (D-169). 시스템 확인(확인 필요·카드 대조)과 회사 메모로도 부족할 때.
// mode="office": 요청 남기기·해결 / mode="company": 답변. 같은 목록을 양쪽이 본다
export function TaxRequests({
  mode,
  requests,
  month,
  companyId,
  items = [],
}: {
  mode: "office" | "company";
  requests: TaxRequest[];
  month: string;
  companyId?: string;
  items?: { id: string; label: string }[];
}) {
  const [body, setBody] = useState("");
  const [itemId, setItemId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string, after?: () => void) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await fn();
        if (!r.ok) return setMsg({ kind: "error", text: r.error });
        after?.();
        setMsg({ kind: "ok", text: ok });
      } catch {
        setMsg({ kind: "error", text: thrownActionMessage() });
      }
    });
  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <section id="tax-requests" className="min-w-0 scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="세무사무소 자료 요청">
      <h2 className="flex flex-wrap items-center gap-1.5 font-semibold">
        <MessageSquareMore className="size-4 text-zinc-500" aria-hidden />
        {mode === "office" ? "회사에 자료 요청" : "세무사무소 자료 요청"}
        {openCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">답변 기다림 {openCount}건</span>}
      </h2>
      <p className="mt-0.5 break-keep text-sm text-zinc-600">
        {mode === "office"
          ? "확인 필요 표시·카드 대조·회사 메모를 보고도 자료가 없거나 부족하면 회사에 요청하세요. 회사 관리자에게 알림이 가고, 답변이 오면 알려 드려요."
          : "세무사무소가 확인하다 부족한 자료를 요청했어요. 답변을 남기거나, 빠진 결의서를 올리거나(다음 달 전월 추가분으로 들어가요), 필요하면 최고 관리자가 마감을 해제해 고쳐 주세요."}
      </p>

      {mode === "office" && companyId && (
        <form
          className="mt-3 flex flex-col gap-2 rounded-lg bg-zinc-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createTaxRequestAction(companyId, month, itemId || null, body), "요청을 보냈어요. 회사 관리자에게 알림이 갔어요.", () => {
              setBody("");
              setItemId("");
            });
          }}
        >
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">어느 영수증에 대한 요청인가요? (선택)</span>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={`${inputClass} min-w-0`}>
              <option value="">{monthLabel(month)} 전체(특정 영수증 아님)</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">요청 내용</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} required className={inputClass} placeholder="예: 9월 ○○상사 세금계산서(330,000원)에 맞는 결의서가 없어요. 확인 부탁드려요." />
          </label>
          <button type="submit" disabled={pending || !body.trim()} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:self-end">
            {pending ? "보내는 중..." : "요청 보내기"}
          </button>
        </form>
      )}
      {msg && (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-2 break-keep text-sm ${msg.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {msg.text}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{mode === "office" ? "남긴 요청이 없어요." : "받은 요청이 없어요."}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {requests.map((r) => {
            const [label, tone] = STATUS[r.status];
            return (
              <li key={r.id} className="min-w-0 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                  <span className="text-xs text-zinc-500">
                    {monthLabel(r.month)}
                    {r.item_label ? ` · 영수증 ${r.item_label}` : " · 달 전체"} · {r.office_name ?? "세무사무소"} {r.requested_by_name ?? ""} · {formatDateTimeKst(r.created_at)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-zinc-900">{r.body}</p>
                {r.answer && (
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-blue-50 px-3 py-2 text-blue-900">
                    <span className="text-xs text-blue-700">
                      회사 답변 · {r.answered_by_name ?? "관리자"} · {r.answered_at ? formatDateTimeKst(r.answered_at) : ""}
                    </span>
                    <br />
                    {r.answer}
                  </p>
                )}
                {mode === "company" && r.status !== "resolved" && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <textarea
                      value={answers[r.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [r.id]: e.target.value }))}
                      maxLength={500}
                      rows={2}
                      aria-label="답변"
                      className={`${inputClass} min-w-0 flex-1`}
                      placeholder={r.answer ? "답변 고치기" : "예: 법인카드 개인 사용으로 처리했어요(카드 대조 참고) / 결의서를 올렸어요"}
                    />
                    <button
                      type="button"
                      disabled={pending || !(answers[r.id] ?? "").trim()}
                      onClick={() => run(() => answerTaxRequestAction(r.id, answers[r.id] ?? ""), "답변을 보냈어요. 세무사무소에 알림이 갔어요.", () => setAnswers((a) => ({ ...a, [r.id]: "" })))}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      답변 보내기
                    </button>
                  </div>
                )}
                {mode === "office" && (
                  <div className="mt-2 flex gap-2">
                    {r.status !== "resolved" ? (
                      <button type="button" disabled={pending} onClick={() => run(() => setTaxRequestStatusAction(r.id, true), "해결로 바꿨어요.")} className="inline-flex min-h-10 items-center rounded-lg border border-emerald-300 bg-white px-3 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                        해결
                      </button>
                    ) : (
                      <button type="button" disabled={pending} onClick={() => run(() => setTaxRequestStatusAction(r.id, false), "다시 열었어요.")} className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50">
                        다시 열기
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
