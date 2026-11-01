import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ISSUE_KINDS, ISSUE_LABEL, type IssueKind } from "@/lib/tax/export-rows";

// 영수증 문제 한눈에(D-195): 종류별 건수 칩, 누르면 그 영수증만. hrefs(서버 화면, 주소로 거르기) 또는 onPick(회사 화면, 바로 거르기)
export function IssueChips({
  counts,
  flagged,
  active,
  hrefs,
  onPick,
}: {
  counts: Partial<Record<IssueKind, number>>;
  flagged: number; // 문제가 하나라도 있는 영수증 수
  active: IssueKind | null;
  hrefs?: Partial<Record<IssueKind | "all", string>>;
  onPick?: (k: IssueKind | null) => void;
}) {
  if (flagged === 0)
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        확인할 영수증이 없어요.
      </p>
    );
  const chip = (on: boolean, tone: string) =>
    `inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm ${on ? "border-zinc-900 bg-zinc-900 font-semibold text-white" : tone}`;
  const item = (key: IssueKind | "all", label: string, n: number, tone: string) => {
    const on = key === "all" ? active === null : active === key;
    const body = (
      <>
        {label} <b className="tabular-nums">{n}</b>
      </>
    );
    if (hrefs?.[key]) return <Link key={key} href={hrefs[key]!} scroll={false} aria-current={on ? "true" : undefined} className={chip(on, tone)}>{body}</Link>;
    return (
      <button key={key} type="button" aria-pressed={on} onClick={() => onPick?.(key === "all" ? null : key)} className={chip(on, tone)}>
        {body}
      </button>
    );
  };
  return (
    <section className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3" aria-label="확인할 영수증">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        확인할 영수증 {flagged}건
        <span className="font-normal text-amber-800">· 누르면 그 영수증만 보여요</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {active !== null && item("all", "전체 보기", flagged, "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50")}
        {ISSUE_KINDS.filter((k) => (counts[k] ?? 0) > 0).map((k) =>
          item(k, ISSUE_LABEL[k], counts[k] ?? 0, k === "review" || k === "no_evidence" ? "border-red-200 bg-white text-red-700 hover:bg-red-50" : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"),
        )}
      </div>
    </section>
  );
}

// 칩에 쓸 집계: 영수증마다 문제 종류
export function countIssues(list: IssueKind[][]): { counts: Partial<Record<IssueKind, number>>; flagged: number } {
  const counts: Partial<Record<IssueKind, number>> = {};
  let flagged = 0;
  for (const ks of list) {
    if (ks.length) flagged++;
    for (const k of ks) counts[k] = (counts[k] ?? 0) + 1;
  }
  return { counts, flagged };
}
