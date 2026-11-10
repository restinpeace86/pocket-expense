import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

// 크레딧 사용 내역(8-104, 2026-11-11 사용자 결정): 직원 화면에는 크레딧을 보여 주지 않고, 관리자가 여기서 누가·언제·무엇에 썼는지 본다
export type CreditUsage = {
  remaining: number;
  receipt: number;
  convert: number;
  rows: { id: string; at: string; reason: "receipt_upload" | "doc_convert" | "doc_convert_refund"; delta: number; note: string | null; member_name: string | null }[];
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const what = (r: CreditUsage["rows"][number]) =>
  r.reason === "receipt_upload" ? "영수증 읽기" : r.reason === "doc_convert" ? `서류 → 엑셀 · ${r.note ?? ""}` : `서류 → 엑셀 · ${r.note ?? "돌려줌"}`;
const shift = (month: string, d: number) => {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function CreditUsageSection({ base, month, thisMonth, data }: { base: string; month: string; thisMonth: string; data: CreditUsage | null }) {
  const [y, m] = month.split("-").map(Number);
  const tiles: [string, number][] = data
    ? [
        ["이번 달 쓴 크레딧", data.receipt + data.convert],
        ["영수증 읽기", data.receipt],
        ["서류 → 엑셀", data.convert],
        ["남은 크레딧", Math.max(0, data.remaining)],
      ]
    : [];
  return (
    <section id="credit-usage" aria-labelledby="credit-usage-title" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" data-credit-usage>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="credit-usage-title" className="text-lg font-bold">
          크레딧 사용 내역
        </h2>
        <span className="ml-auto flex items-center gap-1 text-sm">
          <Link href={`${base}?month=${shift(month, -1)}#credit-usage`} aria-label="이전 달" className="flex size-9 items-center justify-center rounded-lg hover:bg-zinc-100">
            <ChevronLeft className="size-4" />
          </Link>
          <b className="tabular-nums" data-usage-month>
            {y}년 {m}월
          </b>
          {month < thisMonth ? (
            <Link href={`${base}?month=${shift(month, 1)}#credit-usage`} aria-label="다음 달" className="flex size-9 items-center justify-center rounded-lg hover:bg-zinc-100">
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className="size-9" />
          )}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-zinc-600">직원 화면에는 크레딧이 보이지 않아요. 누가 언제 어디에 썼는지는 여기서만 볼 수 있어요. 서류 → 엑셀은 1쪽에 1크레딧, 표를 못 찾으면 돌려줘요.</p>
      {!data ? (
        <p className="text-sm text-zinc-600">내역을 불러오지 못했어요.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {tiles.map(([label, n], i) => (
              <div key={label} className="rounded-xl border border-zinc-200 px-3.5 py-2.5">
                <span className="block text-[13px] text-zinc-600">{i === 0 && month !== thisMonth ? "이 달 쓴 크레딧" : label}</span>
                <b className="text-xl tabular-nums" data-usage-tile={i}>
                  {n.toLocaleString("ko-KR")}
                </b>
              </div>
            ))}
          </div>
          {data.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-600">이 달에 쓴 크레딧이 없어요.</p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-zinc-200 text-sm" aria-label="크레딧 사용 줄">
              {data.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-zinc-100 px-3.5 py-2.5 last:border-b-0 md:flex-nowrap" data-usage-row={r.reason}>
                  <span className="w-full text-xs text-zinc-500 md:w-36 md:shrink-0 md:text-sm">{when(r.at)}</span>
                  <span className="shrink-0 font-medium md:w-24">{r.member_name ?? "-"}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700">{what(r)}</span>
                  <b className={`shrink-0 tabular-nums ${r.delta > 0 ? "text-emerald-700" : ""}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
