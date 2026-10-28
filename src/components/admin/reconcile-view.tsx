"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { reconcileCardStatementAction, saveReconcileAction } from "@/app/workspace/[id]/admin/corporate-cards/reconcile/actions";
import { useRouter } from "next/navigation";
import { majorityMonth } from "@/lib/cards/saved";
import { guardAction } from "@/lib/action-guard";
import { FormError } from "@/components/onboarding/field";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import { readStatementFile } from "@/lib/cards/read-statement";
import type { ReconcileResult } from "@/lib/cards/reconcile";
import { detectColumns, toRows, type Cell, type ColumnMap } from "@/lib/cards/statement";
import { claimStatusBadge } from "@/lib/expense/status";
import type { ClaimStatus } from "@/lib/expense/status";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

// 법인카드 사용 내역 대조 (D-111, D-154): 카드사 엑셀·CSV → 열 확인 → 영수증과 짝 맞추기 → 결과 저장(달별) → 건별 처리.
// 카드 내역 파일 자체는 저장하지 않고, 맞지 않는 건과 처리 내용만 저장해 세무 마감·세무사에게 넘긴다
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";

export function ReconcileHeading() {
  return (
    <SectionHeading
      as="h1"
      title="법인카드 내역 대조"
      summary="세무 마감 전에 해 두면 좋아요. 카드사 사용 내역을 올리면 결의서가 없는 결제를 찾아 주고, 결과와 처리 내용이 세무사에게 함께 넘어가요."
      helpId="admin.reconcile"
      help={
        <>
          <p>
            <b>꼭 해야 하나요?</b> 막지는 않아요. 하지만 세무사는 카드 사용 내역을 따로 받는 경우가 많아서, 넘긴 자료와 카드 내역이 다르면 회사에 하나하나 물어봐요. 마감 전에 대조하고 맞지 않는 건의 처리(결의서 작성 요청·개인 사용·세무사 확인 필요 등)를 골라 두면 세무사가 다시 묻지 않아도 돼요.
          </p>
          <p>
            <b>무엇을 찾나요?</b> ① 카드는 썼는데 결의서(영수증)가 안 올라온 결제 ② 법인카드로 결제됐는데 개인(사비)으로 올린 영수증(그대로 지급하면 이중 지급) ③ 법인카드로 올렸는데 카드 내역에 없는 영수증(개인카드를 법인카드로 잘못 고른 것일 수 있음).
          </p>
          <p>
            <b>어떻게 맞추나요?</b> 같은 금액 · 날짜 ±1일(승인일·매입일 차이) · 카드 끝 4자리가 같으면 같은 결제로 봐요. 작성 중인 결의서도 &ldquo;올라온 것&rdquo;으로 봐요.
          </p>
          <p>
            <b>파일은?</b> 카드사 홈페이지(법인) › 이용내역 조회 › 엑셀 내려받기. xlsx·xls·csv를 올려 주세요. 올린 파일 자체는 저장하지 않고, 맞지 않는 건(날짜·가맹점·금액·카드 끝 4자리)과 처리 내용만 달별로 저장해요.
          </p>
        </>
      }
    />
  );
}

const FIELDS: [keyof ColumnMap, string, boolean][] = [
  ["date", "이용일자", true],
  ["merchant", "가맹점", false],
  ["amount", "이용금액", true],
  ["card", "카드번호", false],
  ["status", "취소·승인 구분", false],
  ["bizNo", "가맹점 사업자번호", false],
];

export function ReconcileView({ base, holders }: { base: string; holders: Record<string, string> }) {
  const [table, setTable] = useState<Cell[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [year] = useState(() => Number(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 4))); // 연도 없는 날짜(10/14)용

  const headers = table ? (table[headerRow] ?? []).map((c) => (c == null ? "" : String(c instanceof Date ? c.toISOString().slice(0, 10) : c))) : [];
  const parsed = table && map && map.date >= 0 && map.amount >= 0 ? toRows(table, headerRow, map, year) : null;

  async function onFile(f: File) {
    setError(null);
    setResult(null);
    setReading(true);
    const r = await readStatementFile(f);
    setReading(false);
    if ("error" in r) return setError(r.error);
    setFileName(f.name);
    setTable(r.table);
    const d = detectColumns(r.table);
    if (d) {
      setHeaderRow(d.headerRow);
      setMap(d.map);
    } else {
      setHeaderRow(0);
      setMap({ date: -1, merchant: -1, amount: -1, card: null, status: null, bizNo: null });
      setError("머리글(이용일자·금액)을 찾지 못했어요. 아래에서 머리글 줄과 열을 직접 골라 주세요.");
    }
  }

  function run() {
    if (!parsed) return;
    setError(null);
    startTransition(async () => {
      const r = await measureAction("reconcile.card_statement", () => reconcileCardStatementAction(parsed.rows));
      if (!r.ok) return setError(r.error);
      setResult(r.result);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <SectionHeading title="1. 카드 내역 파일 올리기" summary="카드사에서 내려받은 엑셀(xlsx·xls) 또는 CSV" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {reading ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            파일 고르기
          </button>
          {fileName && <span className="min-w-0 break-all text-sm text-zinc-600">{fileName}</span>}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            aria-label="카드 내역 파일"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <FormError message={error} />

      {table && map && (
        <section className={card}>
          <SectionHeading title="2. 열 확인" summary="자동으로 찾은 열이에요. 다르면 바꿔 주세요." />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-800">머리글 줄</span>
              <select className={inputClass} value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                {table.slice(0, 30).map((r, i) => (
                  <option key={i} value={i}>
                    {i + 1}줄: {r.slice(0, 4).map((c) => (c == null ? "" : String(c))).join(" | ").slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
            {FIELDS.map(([k, label, required]) => (
              <label key={k} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800">
                  {label}
                  {required && <span className="ml-0.5 text-red-600">*</span>}
                </span>
                <select
                  className={inputClass}
                  value={map[k] ?? -1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMap({ ...map, [k]: v < 0 && (k === "card" || k === "status" || k === "bizNo") ? null : v });
                    setResult(null);
                  }}
                >
                  <option value={-1}>{required ? "골라 주세요" : "없음"}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `(${i + 1}번째 열)`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {parsed && (
            <p className="mt-3 text-sm text-zinc-600">
              결제 {parsed.rows.filter((r) => !r.cancelled).length}건 읽음{parsed.rows.some((r) => r.cancelled) && ` · 취소 ${parsed.rows.filter((r) => r.cancelled).length}건 제외`}
              {parsed.skipped > 0 && ` · 합계·빈 줄 ${parsed.skipped}줄 건너뜀`}
            </p>
          )}
          <button type="button" onClick={run} disabled={pending || !parsed?.rows.length} className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending && <Loader2 className="size-4 animate-spin" />}
            3. 영수증과 대조하기
          </button>
        </section>
      )}

      {result && <Results result={result} base={base} holders={holders} />}
      {result && parsed && <SaveResult result={result} fileName={fileName} dates={parsed.rows.filter((x) => !x.cancelled).map((x) => x.date)} />}
    </div>
  );
}

function Results({ result: r, base, holders }: { result: ReconcileResult; base: string; holders: Record<string, string> }) {
  const date = (d: string) => d.slice(5).replace("-", "/");
  const cardOf = (l: string | null) => (l ? (holders[l] ? `${holders[l]} (${l})` : `끝 ${l}`) : "카드 미상");
  return (
    <div className="flex flex-col gap-4" aria-label="대조 결과">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["결의서 없음", r.missing.length, r.missing.length ? "text-red-700" : "text-zinc-500"],
            ["개인으로 올림", r.personal.length, r.personal.length ? "text-red-700" : "text-zinc-500"],
            ["내역에 없는 영수증", r.extra.length, r.extra.length ? "text-amber-700" : "text-zinc-500"],
            ["짝 맞음", r.matched.length, "text-green-700"],
          ] as const
        ).map(([label, n, cls]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${cls}`}>{n}</p>
            <p className="text-xs text-zinc-600">{label}</p>
          </div>
        ))}
      </div>

      <section className={card}>
        <h2 className="flex items-center gap-1.5 font-semibold text-red-700">
          <AlertTriangle className="size-4" /> 카드는 썼는데 결의서가 없어요 ({r.missing.length})
        </h2>
        {r.missing.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">없어요. 모든 결제에 영수증이 올라와 있어요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {r.missing.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="tabular-nums text-zinc-500">{date(m.date)}</span>
                <span className="min-w-0 flex-1 break-words font-medium">{m.merchant || "(가맹점 없음)"}</span>
                <span className="font-semibold tabular-nums">{formatWon(m.amount)}</span>
                <span className="w-full text-xs text-zinc-500 sm:w-auto">{cardOf(m.last4)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.personal.length > 0 && (
        <section className={card}>
          <h2 className="flex items-center gap-1.5 font-semibold text-red-700">
            <AlertTriangle className="size-4" /> 법인카드 결제인데 개인(사비)으로 올렸어요 ({r.personal.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-600">그대로 지급하면 같은 돈을 두 번 내게 돼요. 결의서를 반려해 결제수단을 고치게 해 주세요.</p>
          <MatchList list={r.personal} base={base} date={date} cardOf={cardOf} />
        </section>
      )}

      {r.extra.length > 0 && (
        <section className={card}>
          <h2 className="flex items-center gap-1.5 font-semibold text-amber-700">
            <AlertTriangle className="size-4" /> 법인카드로 올렸는데 카드 내역에 없어요 ({r.extra.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-600">개인카드를 법인카드로 잘못 골랐거나, 금액·날짜가 영수증과 다를 수 있어요.</p>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {r.extra.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="tabular-nums text-zinc-500">{date(it.date)}</span>
                <span className="min-w-0 flex-1 break-words font-medium">{it.merchant || "(가맹점 없음)"}</span>
                <span className="font-semibold tabular-nums">{formatWon(it.amount)}</span>
                <ClaimLink base={base} id={it.claimId} title={it.claimTitle} status={it.claimStatus} member={it.memberName} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className={card}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold text-green-700 [&::-webkit-details-marker]:hidden">
          <CheckCircle2 className="size-4" /> 짝이 맞은 결제 ({r.matched.length}) {r.cancelled > 0 && <span className="text-sm font-normal text-zinc-500">· 취소 {r.cancelled}건 제외</span>}
        </summary>
        <MatchList list={r.matched} base={base} date={date} cardOf={cardOf} />
      </details>
    </div>
  );
}

function MatchList({ list, base, date, cardOf }: { list: ReconcileResult["matched"]; base: string; date: (d: string) => string; cardOf: (l: string | null) => string }) {
  return (
    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
      {list.map(({ row, item }) => (
        <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span className="tabular-nums text-zinc-500">{date(row.date)}</span>
          <span className="min-w-0 flex-1 break-words font-medium">{row.merchant || item.merchant}</span>
          <span className="font-semibold tabular-nums">{formatWon(row.amount)}</span>
          <span className="text-xs text-zinc-500">{cardOf(row.last4)}</span>
          <ClaimLink base={base} id={item.claimId} title={item.claimTitle} status={item.claimStatus} member={item.memberName} />
        </li>
      ))}
    </ul>
  );
}

function ClaimLink({ base, id, title, status, member }: { base: string; id: string; title: string; status: string; member: string }) {
  const b = claimStatusBadge(status as ClaimStatus);
  const href = status === "draft" ? null : `${base}/admin/claims/${id}`;
  const body = (
    <>
      {member && `${member} · `}
      {title} <span className={`ml-1 rounded-full px-1.5 py-0.5 ${b.className}`}>{b.label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="w-full break-words text-xs text-brand-700 underline-offset-2 hover:underline">
      {body}
    </Link>
  ) : (
    <span className="w-full break-words text-xs text-zinc-500">{body}</span>
  );
}

// 4. 결과 저장(달별, D-154): 같은 달은 덮어쓰고 이미 고른 처리는 유지
function SaveResult({ result, fileName, dates }: { result: ReconcileResult; fileName: string; dates: string[] }) {
  const router = useRouter();
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort().reverse();
  const [month, setMonth] = useState(majorityMonth(dates) ?? months[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sorted = [...dates].sort();
  const issues = result.missing.length + result.personal.length + result.extra.length;
  return (
    <section className={card} aria-label="대조 결과 저장">
      <SectionHeading title="4. 결과 저장" summary="저장하면 맞지 않는 건마다 처리를 고를 수 있고, 세무 마감 화면과 세무사 자료에 함께 들어가요." />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 font-medium text-zinc-800">어느 달 대조인가요?</span>
          <select aria-label="대조한 달" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} sm:w-40`}>
            {months.map((m) => (
              <option key={m} value={m}>
                {m.slice(0, 4)}년 {Number(m.slice(5))}월
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !month}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await guardAction(() => saveReconcileAction(month, fileName, result, { from: sorted[0] ?? null, to: sorted[sorted.length - 1] ?? null }));
              if (!r.ok) return setError(r.error);
              router.push(`?month=${month}`);
              router.refresh();
            });
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          대조 결과 저장 (맞지 않는 {issues}건)
        </button>
      </div>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </section>
  );
}
