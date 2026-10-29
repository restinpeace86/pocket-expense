import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SpendingReport, type SpendingGroup } from "@/components/admin/spending-report";
import { MonthPicker } from "@/components/tax-office/month-picker";
import { AccountTitleHistory, type AccountTitleChange } from "@/components/tax-office/account-title-history";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { isOwnCar } from "@/lib/tax/export-rows";

export const metadata = { title: "월별 지출 현황 · PocketExpense" };

// 월별 지출 현황 (D-160, 개선사항 3): 승인·지급된 지출이 어떤 계정과목으로 세무사무소에 넘어가는지 보기만 한다.
// 계정과목 변경 버튼 없음. 행은 세무 마감과 같은 기준(사용일자 달, 승인·지급)
export default function SpendingPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/spending">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="월별 지출 현황"
        summary="승인된 지출이 어떤 계정과목으로 분류돼 세무사무소에 넘어가는지 확인해요. 계정과목을 누르면 그 영수증들이 보여요."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function recentMonths(now: string): string[] {
  const [y, m] = now.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/spending">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireWorkspace(id, { admin: true });
  const now = currentMonthKst();
  const months = recentMonths(now);
  const month = typeof sp.month === "string" && MONTH.test(sp.month) && sp.month <= now ? sp.month : months[0];
  const supabase = await createClient();
  const [res, { data: office }, { data: changes }] = await Promise.all([
    getTaxMonth(month),
    supabase.rpc("my_company_tax_office"),
    supabase.from("account_title_changes").select("id, entity, action, detail, actor_name, office_name, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (!res.ok) notFound();
  const o = office as { registered?: boolean; registered_name?: string | null } | null;
  const byTitle = new Map<string, SpendingGroup>();
  let total = 0;
  for (const r of res.data.rows) {
    const amount = r.amount ?? 0;
    total += amount;
    const key = r.account_title_name ?? "";
    const g = byTitle.get(key) ?? { key: key || "-", name: r.account_title_name ?? "미지정", code: r.account_title_code, amount: 0, items: [] };
    g.amount += amount;
    g.items.push({
      id: r.item_id,
      date: r.expense_date,
      merchant: isOwnCar(r) ? `자차 ${r.start_location ?? ""}→${r.end_location ?? ""}` : (r.merchant_name ?? "-"),
      member: r.member_name,
      amount,
      overridden: !!r.account_title_overridden,
    });
    byTitle.set(key, g);
  }
  const groups = [...byTitle.values()].sort((a, b) => b.amount - a.amount);
  const [y, m] = month.split("-").map(Number);
  const base = `/workspace/${id}/admin/spending`;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <MonthPicker months={months.includes(month) ? months : [month, ...months]} value={month} base={base} label="볼 달" />
        <p className="text-sm text-zinc-600">
          {y}년 {m}월 승인 지출 <b className="text-lg tabular-nums text-zinc-900">{total.toLocaleString("ko-KR")}원</b> · {res.data.rows.length}건
        </p>
      </section>
      <p className="break-keep rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
        {o?.registered ? (
          <>
            계정과목은 <b>{o.registered_name}</b>이(가) 관리해요. 이 화면은 보기만 할 수 있고, 바꿔야 하면 결재 화면에서 [세무사 확인 요청]을 남겨 주세요.
          </>
        ) : (
          <>이 화면은 보기만 할 수 있어요. 분류 기준(지출 종류 → 계정과목)은 아래 [계정과목 분류 기준]에서 확인해요.</>
        )}
      </p>
      <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="계정과목별 지출">
        <h2 className="font-semibold">계정과목별 지출</h2>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">이 달에 승인된 지출이 없어요.</p>
        ) : (
          <SpendingReport groups={groups} total={total} />
        )}
        {res.data.excluded.claims > 0 && (
          <p className="mt-2 break-keep text-xs text-zinc-500">아직 승인되지 않은 결의서 {res.data.excluded.claims}건은 빠져 있어요(승인되면 들어가요).</p>
        )}
      </section>
      <Link
        href={`/workspace/${id}/admin/account-titles`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 sm:self-start"
      >
        계정과목 분류 기준 보기
      </Link>
      {(o?.registered || (changes ?? []).length > 0) && <AccountTitleHistory changes={(changes ?? []) as AccountTitleChange[]} />}
    </div>
  );
}
