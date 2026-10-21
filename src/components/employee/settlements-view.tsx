import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { formatDateTimeKst } from "@/lib/claims/format";
import type { SettlementCard } from "@/lib/employee/settlements";
import { formatWon } from "@/lib/format";

// 화면 E-03 정산 내역 및 입금 타임라인 (worker-timeline.md)
function period(c: SettlementCard) {
  if (!c.dateFrom || !c.dateTo) return null;
  const a = c.dateFrom.replaceAll("-", ".");
  return c.dateFrom === c.dateTo ? a : `${a}~${c.dateTo.slice(5).replace("-", ".")}`;
}

export function SettlementsView({
  cards,
  hasBank,
  waiting,
  paidThisMonth,
  payback,
  base,
}: {
  cards: SettlementCard[];
  hasBank: boolean;
  waiting: number;
  paidThisMonth: number;
  payback: number;
  base: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-bold tracking-tight">정산 내역</h1>
      {!hasBank && (
        <Link href={`${base}/profile`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          정산받을 계좌를 등록해 주세요 → 내 정보
        </Link>
      )}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-brand-600 p-4 text-white">
          <p className="text-xs text-white/85">입금 대기 중인 사비</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatWon(waiting)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">이번 달 지급받은 정산금</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatWon(paidThisMonth)}</p>
        </div>
      </section>
      {payback > 0 && <p className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">법인카드 한도 초과 납부 필요 {formatWon(payback)}</p>}

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          정산할 내역이 없어요.
          <br />
          사비로 쓴 영수증이 승인되면 여기에 나와요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((c) => (
            <li key={c.id} className="rounded-2xl border border-zinc-200 bg-white">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-col gap-1 p-4 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-keep font-semibold [overflow-wrap:anywhere]">{c.title || "제목 없는 결의서"}</span>
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "paid" ? "bg-purple-100 text-purple-700" : "bg-yellow-100 text-yellow-800"}`}>
                      {c.status === "paid" ? "💰 지급 완료" : "🟡 정산 대기"}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {[period(c), `사비 ${c.personalCount}건`, c.corporateCount > 0 && `(법인 ${c.corporateCount}건은 정산 없음)`].filter(Boolean).join(" · ")}
                  </span>
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold tabular-nums">지급 {formatWon(c.payout)}</span>
                    <ChevronDown className="size-5 text-zinc-400 transition-transform group-open:rotate-180" />
                  </span>
                  {c.payback > 0 && <span className="text-xs text-orange-700">납부 {formatWon(c.payback)}</span>}
                  <span className="text-xs text-zinc-500">{c.status === "paid" ? `└ ${formatDateTimeKst(c.paid_at)} 지급 완료` : `└ ${formatDateTimeKst(c.approved_at)} 승인 · 회사 이체를 기다리는 중`}</span>
                </summary>
                <ul className="flex flex-col gap-1.5 border-t border-zinc-100 px-4 py-3 text-sm">
                  {c.items.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-zinc-700">
                        {i.expense_date?.slice(5).replace("-", "/")} {i.merchant_name ?? "가맹점 미입력"}
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        {i.amount !== null && i.amount !== i.supported ? `${formatWon(i.amount)} → ` : ""}
                        <b>{formatWon(i.supported)}</b>
                        {i.over > 0 && <span className="block text-xs text-orange-700">한도초과 {formatWon(i.over)}</span>}
                      </span>
                    </li>
                  ))}
                  <li>
                    <Link href={`${base}/claims/${c.id}`} className="text-xs text-brand-700 underline underline-offset-2">
                      결의서 보기
                    </Link>
                  </li>
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
