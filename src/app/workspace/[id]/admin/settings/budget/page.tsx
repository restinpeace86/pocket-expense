import Link from "next/link";
import { Suspense } from "react";
import { BudgetBars } from "@/components/admin/budget-bars";
import { BudgetForm } from "@/components/admin/budget-form";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import type { BudgetStatus } from "@/lib/budget/format";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `예산 · ${BRAND.name}` };

// 설정 › 경비 정책 › 예산(D-267, 9-23): 이번 달 쓴 돈(예산이 있으면 비율) + 예산 정하기. 관리자만
export default function BudgetPage({ params }: PageProps<"/workspace/[id]/admin/settings/budget">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="예산"
        summary="이번 달에 계정과목별로 얼마 썼는지 보고, 예산을 정하면 80%·100%를 넘을 때 [알림]방으로 알려 드려요. 결재를 막지는 않아요."
        helpId="budget"
        help={
          <>
            <p>
              <b>무엇을 세나요?</b> 사용일이 이번 달인 지출 중 결재가 올라온 것과 승인·지급된 것이에요. 임시 저장과 반려는 빼요. 승인 전에 미리 알 수 있게 결재 올린 것도 세요.
            </p>
            <p>
              <b>예:</b> 복리후생비 예산을 500,000원으로 정하면, 결재가 올라와 쓴 돈이 400,000원이 되는 순간 &quot;80%를 썼어요&quot;, 500,000원을 넘는 순간 &quot;예산을 넘었어요&quot; 알림이 관리자에게 한 번씩 가요.
            </p>
            <p>예산을 넘어도 결재·승인은 그대로 돼요. 결재 화면에는 &quot;이 결의서까지 복리후생비 예산 104%&quot;처럼 한 줄로 보여요. 직원 화면에는 예산이 보이지 않아요.</p>
          </>
        }
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/admin/settings/budget">, "params">) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const [{ data }, { data: titles }] = await Promise.all([
    supabase.rpc("budget_status", {}),
    supabase.from("account_titles").select("id, name").eq("company_id", membership.company_id).order("sort_order"),
  ]);
  const status = data as unknown as BudgetStatus | null;
  if (!status) return <p className="text-sm text-red-700">예산 현황을 불러오지 못했어요. 새로 고침해 주세요.</p>;
  const byId = new Map(status.titles.map((t) => [t.account_title_id, t]));
  const [, m] = status.month.split("-");
  return (
    <div className="flex flex-col gap-4">
      {!status.enabled && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-budget-plan>
          예산 알림은 프로 플랜부터 쓸 수 있어요. 지금은 이번 달 쓴 돈만 보여요. <Link href={`/workspace/${id}/admin/billing`} className="font-semibold underline">요금제 보기</Link>
        </p>
      )}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5" aria-labelledby="budget-now-title" data-budget-status>
        <h2 id="budget-now-title" className="font-semibold">
          {Number(m)}월 쓴 돈 <span className="text-sm font-normal text-zinc-500">· 결재 올린 것 포함</span>
        </h2>
        <div className="mt-3">
          <BudgetBars status={status} />
        </div>
      </section>
      <BudgetForm
        total={status.total_budget}
        titles={(titles ?? []).map((t) => ({ id: t.id, name: t.name, budget: byId.get(t.id)?.budget ?? null, spent: byId.get(t.id)?.spent ?? 0 }))}
        disabled={!status.enabled}
      />
    </div>
  );
}
