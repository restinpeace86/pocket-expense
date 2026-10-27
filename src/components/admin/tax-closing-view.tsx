"use client";

import { AlertTriangle, FileDown, FileSpreadsheet, Loader2, LockOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeTaxMonthAction, reopenTaxMonthAction, taxClaimDocsAction, taxEvidenceFilesAction } from "@/app/workspace/[id]/admin/export/actions";
import { formatDateTimeKst } from "@/lib/claims/format";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";
import type { TaxMonth } from "@/lib/tax/closing";
import { evidenceFile, evidenceNo, isOwnCar, settlement } from "@/lib/tax/export-rows";
import { buildTaxZip, saveBlob, type ZipProgress } from "@/lib/tax/zip-client";

// 화면: 세무 마감 및 증빙 다운로드 (tax-closing.md, tax-export.md, D-045)
const PREVIEW_ROWS = 300;

export function TaxClosingView({
  data,
  months,
  base,
  claimsBase,
  companyName,
  isSuper,
}: {
  data: TaxMonth;
  months: string[];
  base: string;
  claimsBase: string;
  companyName: string;
  isSuper: boolean;
}) {
  const router = useRouter();
  const { month, rows, status } = data;
  const [y, m] = month.split("-");
  const label = `${y}년 ${Number(m)}월`;
  const total = rows.length;
  const sum = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const pay = rows.reduce((s, r) => s + (settlement(r).kind === "지급" ? settlement(r).amount : 0), 0);
  const back = rows.reduce((s, r) => s + (settlement(r).kind === "납부" ? settlement(r).amount : 0), 0);
  const byAccount = [...rows.reduce((mp, r) => mp.set(r.account_title_name || "(계정 없음)", (mp.get(r.account_title_name || "(계정 없음)") ?? 0) + (r.amount ?? 0)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const ex = data.excluded;
  const excludedItems = ex.draft + ex.submitted + ex.rejected;
  const carry = rows.filter((r) => r.kind === "carryover").length;

  const [confirm, setConfirm] = useState(false);
  const [reopen, setReopen] = useState(false);
  const [reason, setReason] = useState("");
  const [progress, setProgress] = useState<(ZipProgress & { step: string }) | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, start] = useTransition();
  const zipBase = `PocketExpense_${companyName.replace(/[\\/:*?"<>|\s]/g, "")}_${month}`;

  async function downloadPackage(only?: string[]) {
    setMessage(null);
    setProgress({ step: "마감 처리 중", done: 0, total: 0, failed: 0 });
    if (!only) {
      const closed = await measureAction("admin.tax_close", () => closeTaxMonthAction(month));
      if (!closed.ok) {
        setProgress(null);
        return setMessage({ kind: "error", text: closed.error });
      }
    }
    setProgress({ step: "장부(엑셀) 만드는 중", done: 0, total: 0, failed: 0 });
    const [y2, m2] = month.split("-");
    const xlsxRes = await fetch(`${base}/xlsx?month=${month}&mode=package`, { cache: "no-store" });
    if (!xlsxRes.ok) {
      setProgress(null);
      return setMessage({ kind: "error", text: "장부(엑셀)를 만들지 못했어요. 다시 시도해 주세요." });
    }
    const workbook = { name: `${y2}년${Number(m2)}월_세무기장용_장부.xlsx`, data: new Uint8Array(await xlsxRes.arrayBuffer()) };
    const list = await taxEvidenceFilesAction(month, only);
    if (!list.ok) {
      setProgress(null);
      return setMessage({ kind: "error", text: list.error });
    }
    setProgress({ step: "영수증 받는 중", done: 0, total: list.files.length, failed: 0 });
    const t0 = performance.now();
    let pdfNote = "";
    const { parts, failed, extraAdded } = await buildTaxZip({
      workbook,
      files: list.files,
      refreshUrls: async (names) => {
        const r = await taxEvidenceFilesAction(month, names);
        return r.ok ? r.files : [];
      },
      onProgress: (p) => setProgress({ step: "영수증 받는 중", ...p }),
      // 지출결의서 PDF: 받은 영수증 바이트를 그대로 넣는다(T10-3b). 누락분 다시 받기에는 만들지 않는다
      extra: only
        ? undefined
        : async (got) => {
            setProgress({ step: "지출결의서 PDF 만드는 중", done: 0, total: 0, failed: 0 });
            const d = await taxClaimDocsAction(month);
            if (!d.ok) return null;
            const { buildClaimsPdf } = await import("@/lib/tax/pdf-client");
            const n = d.rows.length;
            const evidence = new Map(
              d.rows.map((r) => {
                const f = evidenceFile(r, month, n);
                const data = f ? got.get(f.name) : undefined;
                const ext = f?.name.split(".").pop();
                const what = isOwnCar(r) ? `자차 ${r.start_location ?? ""}→${r.end_location ?? ""}` : (r.merchant_name ?? "");
                return [
                  r.item_id,
                  {
                    no: evidenceNo(month, r.seq, n),
                    label: `증빙 ${evidenceNo(month, r.seq, n)} · ${r.expense_date} · ${what} · ${(r.amount ?? 0).toLocaleString("ko-KR")}원 — ${r.claim_title}`,
                    image: data ? { kind: ext === "pdf" ? ("pdf" as const) : ext === "png" ? ("png" as const) : ("jpg" as const), data } : null,
                  },
                ];
              }),
            );
            try {
              const pdf = await buildClaimsPdf({ docs: d.docs, companyName, month, evidence, layout: d.layout });
              return { name: `지출결의서_${month}.pdf`, data: pdf };
            } catch {
              pdfNote = " 지출결의서 PDF는 만들지 못했어요(글꼴을 받지 못함) — 다시 받기를 눌러 주세요.";
              return null;
            }
          },
    });
    if (!only && !extraAdded && !pdfNote) pdfNote = " 지출결의서 PDF는 만들지 못했어요 — 다시 받기를 눌러 주세요.";
    parts.forEach((b, i) => saveBlob(b, `${zipBase}${only ? "_누락분" : ""}${parts.length > 1 ? `_${i + 1}` : ""}.zip`));
    setProgress(null);
    setMissing(failed);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    setMessage(
      failed.length
        ? { kind: "error", text: `ZIP을 저장했지만 영수증 ${failed.length}장을 받지 못했어요. [못 받은 영수증 다시 받기]를 눌러 주세요.` }
        : { kind: pdfNote ? "error" : "ok", text: `${label} 패키지를 저장했어요 (영수증 ${list.files.length}장${extraAdded ? " + 지출결의서 PDF" : ""}${parts.length > 1 ? `, ${parts.length}개 파일로 나눔` : ""}, ${secs}초).${pdfNote}` },
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 pb-48 sm:pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="tax-month">
          마감 월
        </label>
        <select
          id="tax-month"
          value={month}
          onChange={(e) => router.push(`${base}?month=${e.target.value}`)}
          className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base font-semibold"
        >
          {months.map((mo) => (
            <option key={mo} value={mo}>
              {mo.slice(0, 4)}년 {Number(mo.slice(5))}월
            </option>
          ))}
        </select>
        {status === "closed" ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">🟢 마감 완료{data.closedAt && ` · ${formatDateTimeKst(data.closedAt)}`}</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">🟡 마감 대기</span>
        )}
        {status === "pending" && data.reopenedAt && <span className="text-sm text-zinc-500">마감 해제됨 ({formatDateTimeKst(data.reopenedAt)}, 사유: {data.reopenReason})</span>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={`${label} 요약`}>
        {(
          [
            ["세무 증빙 총액", formatWon(sum), `총 ${total}건${carry ? ` (전월 추가분 ${carry}건 포함)` : ""}`],
            ["직원 지급액", formatWon(pay), "개인카드(사비) 회사 지원금"],
            ["직원 납부액", formatWon(back), "법인카드 개인 부담분"],
            ["영수증·증빙 파일", `${rows.filter((r) => evidenceFile(r, month, total)).length}개`, "ZIP의 영수증/ 폴더"],
          ] as const
        ).map(([k, v, s]) => (
          <div key={k} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{k}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{s}</p>
          </div>
        ))}
      </section>
      {byAccount.length > 0 && (
        <p className="flex flex-wrap gap-2 text-sm">
          {byAccount.map(([k, v]) => (
            <span key={k} className="rounded-full bg-zinc-100 px-3 py-1 tabular-nums">
              {k} {formatWon(v)}
            </span>
          ))}
        </p>
      )}

      {excludedItems > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <AlertTriangle className="size-4 shrink-0" />
          이 달 사용 항목 중 {[ex.submitted && `결재중 ${ex.submitted}건`, ex.draft && `작성중 ${ex.draft}건`, ex.rejected && `반려 ${ex.rejected}건`].filter(Boolean).join(" · ")}(결의서 {ex.claims}건)은 포함되지 않아요.
          <Link href={`${claimsBase}?month=${month}`} className="font-semibold underline underline-offset-2">
            보기
          </Link>
        </p>
      )}

      <p className="text-xs text-zinc-500">
        엑셀의 업로드 시트는 법인카드와 개인(사비)이 따로예요. 영수증은 사진(전자)으로 함께 넘어가요. 종이 원본을 따로 모아 두는지는 회사·세무사무소마다 달라요 — 정한 방식대로 보관해 주세요. 계정코드는 더존 기본 계정코드라 회계 프로그램과 다를 수 있어요(설정 › 계정과목에서 확인·변경).
      </p>

      <section className="@container rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-100 px-4 py-3 font-semibold">
          {label} {status === "closed" ? "마감된" : "승인 완료된"} 지출 내역 <span className="text-sm font-normal text-zinc-500">(세무사무소 전달용 낱개 보기)</span>
        </h2>
        {total === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-zinc-500">이 달에 승인된 지출이 없어요.</p>
        ) : (
          <>
            {/* 넓으면 표, 좁으면(휴대폰·태블릿 세로) 카드 — 화면 폭이 아니라 이 칸의 폭으로 */}
            <div className="hidden @3xl:block">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr>
                    {["증빙번호", "사용일", "소속·이름", "가맹점 (결제)", "금액", "계정과목", "증빙 파일명"].map((h) => (
                      <th key={h} className={`px-3 py-2 font-medium ${h === "금액" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.slice(0, PREVIEW_ROWS).map((r) => {
                    const f = evidenceFile(r, month, total);
                    return (
                      <tr key={r.item_id} className={r.kind === "carryover" ? "bg-sky-50/50" : ""}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{evidenceNo(month, r.seq, total)}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                          {r.expense_date.slice(5).replace("-", "/")}
                          {r.kind === "carryover" && <span className="ml-1 rounded bg-sky-100 px-1 text-[11px] text-sky-800">전월 추가분</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{[r.department, r.member_name].filter(Boolean).join(" ")}</td>
                        <td className="px-3 py-2">
                          {isOwnCar(r) ? `🚗 ${r.start_location ?? ""} → ${r.end_location ?? ""}` : (r.merchant_name ?? "-")}{" "}
                          <span className="whitespace-nowrap text-xs text-zinc-500">[{r.payment_method === "corporate_card" ? "법인" : "개인"}]</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatWon(r.amount ?? 0)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{r.account_title_name ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-zinc-600 [overflow-wrap:anywhere]">{f?.name ?? "(증빙 파일 없음)"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-zinc-100 @3xl:hidden">
              {rows.slice(0, PREVIEW_ROWS).map((r) => (
                <li key={r.item_id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
                  <span className="flex justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{isOwnCar(r) ? `🚗 ${r.start_location ?? ""} → ${r.end_location ?? ""}` : (r.merchant_name ?? "-")}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatWon(r.amount ?? 0)}</span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {evidenceNo(month, r.seq, total)} · {r.expense_date.slice(5).replace("-", "/")} · {r.member_name} · {r.account_title_name ?? "-"} · {r.payment_method === "corporate_card" ? "법인" : "개인"}
                    {r.kind === "carryover" && " · 전월 추가분"}
                  </span>
                </li>
              ))}
            </ul>
            {total > PREVIEW_ROWS && <p className="border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">앞 {PREVIEW_ROWS}건만 보여 줘요. 전체는 엑셀로 확인해 주세요 (총 {total}건).</p>}
          </>
        )}
      </section>

      {missing.length > 0 && (
        <button type="button" disabled={busy || !!progress} onClick={() => start(() => downloadPackage(missing))} className="self-start rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700">
          못 받은 영수증 {missing.length}장 다시 받기
        </button>
      )}

      {status === "closed" && isSuper && (
        <button type="button" onClick={() => setReopen(true)} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium">
          <LockOpen className="size-4" /> 마감 해제
        </button>
      )}

      <div className="kb-hide fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          {progress && (
            <div role="status" aria-live="polite" className="flex flex-col gap-1 text-sm text-zinc-700">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {progress.step}
                {progress.total > 0 && ` ${progress.done}/${progress.total}장`}
                {progress.failed > 0 && <span className="text-red-600">(실패 {progress.failed})</span>}
              </span>
              {progress.total > 0 && (
                <span className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <span className="block h-full bg-brand-600 transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                </span>
              )}
            </div>
          )}
          {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <a
              href={total ? `${base}/xlsx?month=${month}&mode=preview` : undefined}
              aria-disabled={!total}
              className={`inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium ${total ? "hover:bg-zinc-50" : "pointer-events-none opacity-50"}`}
            >
              <FileSpreadsheet className="size-4" /> 엑셀만 미리 받기
            </a>
            <button
              type="button"
              disabled={!total || busy || !!progress}
              onClick={() => (status === "closed" ? start(() => downloadPackage()) : setConfirm(true))}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <FileDown className="size-4" />
              {status === "closed" ? `${Number(m)}월 패키지 다시 받기 (.zip)` : `${Number(m)}월 세무 마감 패키지 다운로드 (.zip)`}
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="close-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setConfirm(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <h2 id="close-title" className="text-lg font-semibold">
              {label}을 마감할까요?
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              <li>다운로드하면 {label}이 <b>마감 완료</b>로 잠겨요. 포함된 {total}건은 계정과목을 바꿀 수 없고, 결의서도 지울 수 없어요.</li>
              <li>마감 뒤 승인되는 {label} 사용분은 다음 마감 패키지에 &ldquo;전월 추가분&rdquo;으로 들어가요.</li>
              <li>다시 받으면 같은 내용·같은 파일명으로 다시 만들어요. 해제는 최고 관리자만 할 수 있어요.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="min-h-12 rounded-xl border border-zinc-300 font-medium">
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirm(false);
                  start(() => downloadPackage());
                }}
                className="min-h-12 rounded-xl bg-brand-600 font-semibold text-white"
              >
                마감하고 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {reopen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="reopen-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setReopen(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <h2 id="reopen-title" className="text-lg font-semibold">
              {label} 마감을 해제할까요?
            </h2>
            <p className="mt-2 text-sm text-zinc-700">해제하면 마감 대기로 돌아가고, 다음 다운로드 때 다시 집계해요. 세무사무소에 이미 보낸 자료와 달라질 수 있어요.</p>
            <label htmlFor="reopen-reason" className="mt-3 block text-sm font-medium">
              해제 사유
            </label>
            <input id="reopen-reason" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-base" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 세무사 요청으로 계정과목 수정" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setReopen(false)} className="min-h-12 rounded-xl border border-zinc-300 font-medium">
                취소
              </button>
              <button
                type="button"
                disabled={!reason.trim() || busy}
                onClick={() =>
                  start(async () => {
                    const r = await reopenTaxMonthAction(month, reason);
                    setReopen(false);
                    setMessage(r.ok ? { kind: "ok", text: `${label} 마감을 해제했어요.` } : { kind: "error", text: r.error });
                    router.refresh();
                  })
                }
                className="min-h-12 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-50"
              >
                마감 해제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
