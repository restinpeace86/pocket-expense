import Link from "next/link";

// 최근 6개월 승인 지출 추이(D-319, 사용자 2026-11-26 "시각적인 거니까 월별 지출 현황도"): 막대 = 달, 고른 달만 진하게 + 금액, 나머지는 마우스 올리면.
// 막대를 누르면 그 달로. 기준은 아래 표와 같음(세무 마감 기준 승인·지급)
export function SpendingTrend({ points, month, hrefFor }: { points: { month: string; total: number }[]; month: string; hrefFor: (m: string) => string }) {
  const max = Math.max(1, ...points.map((p) => p.total));
  const cur = points.find((p) => p.month === month);
  const prev = points[points.findIndex((p) => p.month === month) - 1];
  const diff = cur && prev && prev.total > 0 ? Math.round(((cur.total - prev.total) / prev.total) * 100) : null;
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  const short = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString("ko-KR")}만` : n.toLocaleString("ko-KR"));
  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="trend-title" data-spending-trend>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="trend-title" className="font-semibold">
          최근 6개월
        </h2>
        {diff !== null && (
          <p className="text-sm text-zinc-600" data-trend-diff>
            {Number(month.slice(5, 7))}월은 전달보다{" "}
            <b className={diff > 0 ? "text-rose-700" : diff < 0 ? "text-emerald-700" : "text-zinc-900"}>{diff === 0 ? "같아요" : `${Math.abs(diff)}% ${diff > 0 ? "늘었어요" : "줄었어요"}`}</b>
          </p>
        )}
      </div>
      <ol className="mt-4 grid h-44 grid-cols-6 items-end gap-2 border-b border-zinc-200 sm:gap-4" aria-label="달별 승인 지출">
        {points.map((p) => {
          const on = p.month === month;
          const h = p.total ? Math.max(3, Math.round((p.total / max) * 100)) : 0;
          return (
            <li key={p.month} className="flex h-full min-w-0 flex-col justify-end">
              <Link href={hrefFor(p.month)} title={`${Number(p.month.slice(5, 7))}월 ${won(p.total)}`} aria-current={on ? "page" : undefined} className="group flex h-full flex-col items-center justify-end gap-1 rounded-t-md hover:bg-zinc-50">
                <span className={`text-[11px] tabular-nums sm:text-xs ${on ? "font-semibold text-zinc-900" : "text-zinc-500 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>{short(p.total)}</span>
                <span className={`w-full max-w-12 rounded-t ${on ? "bg-brand-600" : "bg-brand-200 group-hover:bg-brand-300"}`} style={{ height: `${h}%` }} aria-hidden />
                <span className="sr-only">
                  {p.month} {won(p.total)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <ol className="mt-1.5 grid grid-cols-6 gap-2 text-center text-xs text-zinc-500 sm:gap-4" aria-hidden>
        {points.map((p) => (
          <li key={p.month} className={p.month === month ? "font-semibold text-zinc-900" : ""}>
            {Number(p.month.slice(5, 7))}월
          </li>
        ))}
      </ol>
    </section>
  );
}
