"use client";

import { MessageSquareMore } from "lucide-react";
import { useState, useTransition } from "react";
import { createTaxRequestAction, officeAnswerTaxRequestAction, setTaxRequestStatusAction } from "@/app/tax-office/[companyId]/request-actions";
import { answerTaxRequestAction, companySetTaxRequestStatusAction, createCompanyTaxRequestAction } from "@/app/workspace/[id]/admin/export/actions";
import { thrownActionMessage } from "@/lib/action-guard";
import { formatDateTimeKst } from "@/lib/claims/format";
import type { TaxRequest } from "@/lib/tax-office/requests";
import { inputClass } from "@/components/ui/page-shell";

const monthLabel = (m: string) => `${Number(m.slice(5, 7))}월`;
type Side = "office" | "company";
const sideName = (s: Side) => (s === "office" ? "세무사무소" : "회사");

// 상태 이름은 보는 쪽 기준(D-196): 내가 받은 요청이면 "답변 필요", 내가 보낸 요청이면 "답변 기다림"
function statusChip(r: TaxRequest, me: Side): [string, string] {
  if (r.status === "resolved") return ["확인함", "bg-emerald-50 text-emerald-700"];
  if (r.status === "answered") return r.origin === me ? ["답변 옴", "bg-blue-50 text-blue-700"] : ["답변함", "bg-zinc-100 text-zinc-600"];
  return r.origin === me ? ["답변 기다림", "bg-amber-50 text-amber-800"] : ["답변 필요", "bg-red-50 text-red-700"];
}

// 확인 요청 (D-169 → D-196): 회사·세무사무소 누구나 달 전체 또는 영수증에 질문 한 줄 → 받은 쪽이 답 한 줄 → 누구든 [확인함].
// 채팅이 아니라 영수증에 붙는 확인 상태. 상대에게 웹푸시, 아직 안 본 건 "새" 표시. 같은 목록을 양쪽이 본다
export function TaxRequests({
  mode,
  requests,
  month,
  companyId,
  items = [],
}: {
  mode: Side;
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
  const [busy, setBusy] = useState<string | null>(null); // 어느 버튼이 진행 중인지
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string, after?: () => void, key = "other") =>
    start(async () => {
      setBusy(key);
      setMsg(null);
      try {
        const r = await fn();
        if (!r.ok) return setMsg({ kind: "error", text: r.error });
        after?.();
        setMsg({ kind: "ok", text: ok });
      } catch {
        setMsg({ kind: "error", text: thrownActionMessage() });
      } finally {
        setBusy(null);
      }
    });
  const other: Side = mode === "office" ? "company" : "office";
  const needMe = requests.filter((r) => r.status !== "resolved" && ((r.origin !== mode && r.status === "open") || (r.origin === mode && r.status === "answered"))).length;
  const unread = requests.filter((r) => r.unread_for === mode).length;
  const itemMax = mode === "company" && itemId ? 200 : 500; // 회사 영수증 요청은 결재 화면 메모(200자)와 같은 칸

  return (
    <section id="tax-requests" className="min-w-0 scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="확인 요청">
      <h2 className="flex flex-wrap items-center gap-1.5 font-semibold">
        <MessageSquareMore className="size-4 text-zinc-500" aria-hidden />
        {mode === "office" ? "회사와 확인 요청" : "세무사무소와 확인 요청"}
        {unread > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">새 {unread}</span>}
        {needMe > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">내가 볼 차례 {needMe}건</span>}
      </h2>
      <p className="mt-0.5 break-keep text-sm text-zinc-600">
        {mode === "office"
          ? "영수증이나 달 전체에 궁금한 점을 한 줄로 남기면 회사 관리자에게 알림이 가요. 회사가 먼저 남긴 요청에도 여기서 답해요. 해결되면 [확인함]."
          : "세무사무소에 영수증이나 달 전체를 한 줄로 물어보세요(알림이 가요). 세무사무소가 남긴 요청에도 여기서 답해요. 해결되면 [확인함]."}
      </p>

      {(mode === "company" || companyId) && (
        <form
          className="mt-3 flex flex-col gap-2 rounded-lg bg-zinc-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => (mode === "office" ? createTaxRequestAction(companyId!, month, itemId || null, body) : createCompanyTaxRequestAction(month, itemId || null, body)),
              `요청을 보냈어요. ${sideName(other)}에 알림이 갔어요.`,
              () => {
                setBody("");
                setItemId("");
              },
              "send",
            );
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
            <span className="font-medium text-zinc-700">요청 내용 (한 줄)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={itemMax}
              rows={2}
              required
              className={inputClass}
              placeholder={mode === "office" ? "예: 9월 ○○상사 세금계산서(330,000원)에 맞는 결의서가 없어요. 확인 부탁드려요." : "예: 이 영수증은 회의비로 봐야 하나요?"}
            />
          </label>
          <button type="submit" disabled={pending || !body.trim()} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:self-end">
            {pending && busy === "send" ? "보내는 중..." : `${sideName(other)}에 요청 보내기`}
          </button>
        </form>
      )}
      {msg && (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-2 break-keep text-sm ${msg.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {msg.text}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">아직 주고받은 요청이 없어요.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {requests.map((r) => {
            const [label, tone] = statusChip(r, mode);
            const iReceived = r.origin !== mode;
            const fromName = r.origin === "office" ? `${r.office_name ?? "세무사무소"} ${r.requested_by_name ?? ""}` : `회사 ${r.requested_by_name ?? ""}`;
            return (
              <li key={r.id} className={`min-w-0 py-3 text-sm ${r.unread_for === mode ? "-mx-2 rounded-lg bg-red-50/50 px-2" : ""}`}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {r.unread_for === mode && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">새</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{iReceived ? `${sideName(r.origin)}가 보냄` : "내가 보냄"}</span>
                  <span className="text-xs text-zinc-500">
                    {monthLabel(r.month)}
                    {r.item_label ? ` · 영수증 ${r.item_label}` : " · 달 전체"} · {fromName.trim()} · {formatDateTimeKst(r.created_at)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-zinc-900">{r.body}</p>
                {r.answer && (
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-blue-50 px-3 py-2 text-blue-900">
                    <span className="text-xs text-blue-700">
                      {sideName(r.origin === "office" ? "company" : "office")} 답변 · {r.answered_by_name ?? ""} · {r.answered_at ? formatDateTimeKst(r.answered_at) : ""}
                    </span>
                    <br />
                    {r.answer}
                  </p>
                )}
                {iReceived && r.status !== "resolved" && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <textarea
                      value={answers[r.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [r.id]: e.target.value }))}
                      maxLength={500}
                      rows={2}
                      aria-label="답변"
                      className={`${inputClass} min-w-0 flex-1`}
                      placeholder={r.answer ? "답변 고치기" : mode === "company" ? "예: 법인카드 개인 사용으로 처리했어요 / 결의서를 올렸어요" : "예: 회의비(819)로 바꿀게요 / 식대가 맞아요"}
                    />
                    <button
                      type="button"
                      disabled={pending || !(answers[r.id] ?? "").trim()}
                      onClick={() =>
                        run(
                          () => (mode === "company" ? answerTaxRequestAction(r.id, answers[r.id] ?? "") : officeAnswerTaxRequestAction(companyId!, r.id, answers[r.id] ?? "")),
                          `답변을 보냈어요. ${sideName(other)}에 알림이 갔어요.`,
                          () => setAnswers((a) => ({ ...a, [r.id]: "" })),
                        )
                      }
                      className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      답변 보내기
                    </button>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  {r.status !== "resolved" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => (mode === "office" ? setTaxRequestStatusAction(r.id, true) : companySetTaxRequestStatusAction(r.id, true)), "확인함으로 바꿨어요.")}
                      className="inline-flex min-h-10 items-center rounded-lg border border-emerald-300 bg-white px-3 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      확인함
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => (mode === "office" ? setTaxRequestStatusAction(r.id, false) : companySetTaxRequestStatusAction(r.id, false)), "다시 열었어요.")}
                      className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                    >
                      다시 열기
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
