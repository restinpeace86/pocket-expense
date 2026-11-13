import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BudgetBars } from "@/components/admin/budget-bars";
import type { BudgetImpact, BudgetStatus } from "@/lib/budget/format";
import { formatWon } from "@/lib/format";

// 관리자 홈 [이번 달 예산](D-267): 예산이 있으면 막대, 없으면 쓴 만큼 + [예산 정하기]. 쓴 돈이 하나도 없고 예산도 없으면 숨김
export function BudgetHomeCard({ status, href }: { status: BudgetStatus; href: string }) {
  const hasBudget = status.total_budget != null || status.titles.some((t) => t.budget != null);
  if (!hasBudget && status.total_spent === 0) return null;
  const [, m] = status.month.split("-");
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5" aria-labelledby="budget-home-title" data-budget-home>
      <div className="flex items-center justify-between gap-2">
        <h2 id="budget-home-title" className="font-semibold">
          {Number(m)}월 예산 <span className="text-sm font-normal text-zinc-500">· 결재 올린 것 포함</span>
        </h2>
        <Link href={href} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {hasBudget ? "예산 보기" : "예산 정하기"} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-3">
        <BudgetBars status={status} limit={3} />
      </div>
      {!hasBudget && (
        <p className="mt-3 text-xs text-zinc-600">
          예산을 정하면 80%·100%를 넘을 때 [알림]방으로 알려 드려요.{!status.enabled && " (프로 플랜부터)"}
        </p>
      )}
    </section>
  );
}

// 결재 화면 한 줄(D-267): 이 결의서가 들어간 달 예산 중 80%를 넘은 것
export function BudgetImpactNote({ items }: { items: BudgetImpact[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-budget-impact>
      {items.map((x) => (
        <li key={`${x.month}:${x.name}`} className="break-keep">
          이 결의서까지 {Number(x.month.split("-")[1])}월 <b>{x.name}</b> 예산 <b className={x.pct >= 100 ? "text-red-700" : ""}>{x.pct}%</b>
          <span className="text-amber-800/80"> ({formatWon(x.spent)} / {formatWon(x.budget)}) · 승인은 그대로 할 수 있어요</span>
        </li>
      ))}
    </ul>
  );
}
