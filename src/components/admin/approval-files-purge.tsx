"use client";

import { FileStack, Loader2 } from "lucide-react";
import { useState } from "react";
import { purgeApprovalFilesAction as purgeRaw, type PurgeResult } from "@/app/workspace/[id]/admin/chat-settings/actions";
import { bytesLabel } from "@/lib/chat/format";
import { guarded } from "@/lib/action-guard";

const purgeAction = guarded(purgeRaw);

// 기간별로 지울 수 있는 첨부(DB approval_doc_purge_status): "3"·"6"·"12"개월, "0" = 승인된 문서 전부
export type PurgeStatus = Record<"0" | "3" | "6" | "12", { docs: number; files: number; bytes: number }>;

const OPTIONS = [
  { m: 12, label: "승인된 지 1년 지난 문서" },
  { m: 6, label: "승인된 지 6개월 지난 문서" },
  { m: 3, label: "승인된 지 3개월 지난 문서" },
  { m: 0, label: "승인된 문서 전부" },
] as const;

// 결재 문서 첨부 일괄 정리(D-291): 기간 고르기 → 개수·크기 확인 → 한 번 더 확인 → 지움. 막지 않고 알려 주기
export function ApprovalFilesPurge({ companyId, status }: { companyId: string; status: PurgeStatus }) {
  const [months, setMonths] = useState<number>(() => OPTIONS.find((o) => status[String(o.m) as keyof PurgeStatus].files > 0)?.m ?? 12);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PurgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cur = status[String(months) as keyof PurgeStatus];
  const all = status["0"];

  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await purgeAction(companyId, months);
    setBusy(false);
    setAsking(false);
    if ("error" in r && r.error) setError(r.error);
    else setDone(r as PurgeResult);
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-labelledby="purge-title" data-approval-purge>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <FileStack className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="purge-title" className="font-semibold">
            결재 문서 첨부 정리
          </h2>
          <p className="text-sm text-zinc-600">
            승인이 끝난 결재 문서의 첨부 <span className="font-semibold tabular-nums text-zinc-900">{all.files}개</span> · <span className="whitespace-nowrap">{bytesLabel(all.bytes)}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">
        오래된 결재 문서의 첨부 사진·PDF만 한 번에 지워 저장 공간을 비워요. <b>문서 내용·결재 기록·첨부 칸에 적힌 파일 이름은 그대로</b> 남고, 문서에는 &ldquo;관리자가 정리했어요&rdquo;가 보여요. 작성 중·결재 중·반려된 문서는 손대지 않아요.
      </p>

      {all.files === 0 ? (
        <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600" data-purge-empty>
          지금은 정리할 첨부가 없어요.
        </p>
      ) : (
        <>
          <fieldset className="mt-3 flex flex-col gap-1.5" disabled={busy}>
            <legend className="sr-only">정리할 기간</legend>
            {OPTIONS.map((o) => {
              const s = status[String(o.m) as keyof PurgeStatus];
              const on = months === o.m;
              return (
                <label key={o.m} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${on ? "border-brand-500 bg-brand-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
                  <input
                    type="radio"
                    name="purge-months"
                    value={o.m}
                    checked={on}
                    onChange={() => {
                      setMonths(o.m);
                      setAsking(false);
                      setDone(null);
                    }}
                    className="size-4 shrink-0 accent-brand-600"
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold">{o.label}</span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-zinc-600">
                    {s.files ? (
                      <>
                        문서 {s.docs}건 · 첨부 {s.files}개
                        <span className="block font-semibold text-zinc-800">{bytesLabel(s.bytes)}</span>
                      </>
                    ) : (
                      "없음"
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {!asking ? (
            <button
              type="button"
              onClick={() => {
                setAsking(true);
                setDone(null);
              }}
              disabled={!cur.files || busy}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:border-zinc-200 disabled:text-zinc-400 sm:w-auto"
              data-purge-start
            >
              {cur.files ? `첨부 ${cur.files}개 정리하기` : "이 기간엔 정리할 첨부가 없어요"}
            </button>
          ) : (
            <div role="alertdialog" aria-labelledby="purge-ask" className="mt-3 flex flex-col gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3" data-purge-confirm>
              <p id="purge-ask" className="text-sm font-semibold text-red-800">
                문서 {cur.docs}건의 첨부 {cur.files}개({bytesLabel(cur.bytes)})를 지울까요?
              </p>
              <ul className="list-disc pl-5 text-[13px] leading-relaxed text-red-900">
                <li>지운 첨부는 되살릴 수 없어요. 꼭 남길 파일은 먼저 문서에서 받아 두세요.</li>
                <li>계약서·세금 관련 증빙처럼 법으로 보관 기간이 정해진 자료가 있으면 그 기간이 지난 뒤에 정리하는 게 안전해요.</li>
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAsking(false)} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 sm:flex-none">
                  그만두기
                </button>
                <button type="button" onClick={() => void run()} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 sm:flex-none" data-purge-go>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {busy ? "지우는 중…" : "지우기"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {done && (
        <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-800" data-purge-done>
          첨부 {done.files}개를 지웠어요{done.bytes > 0 ? ` · ${bytesLabel(done.bytes)} 비움` : ""}.
          {done.left > 0 && <span className="block text-amber-800">{done.left}개는 지우지 못했어요. 잠시 뒤 다시 눌러 주세요.</span>}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
