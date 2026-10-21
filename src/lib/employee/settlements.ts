import "server-only";
import { formatDateTimeKst } from "@/lib/claims/format";
import { currentMonthKst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// 화면 E-03 정산 내역 (worker-timeline.md): 정산이 필요한 내 결의서(승인됨=정산 대기, 지급 완료). 본인 것만
export type SettlementItem = { id: string; expense_date: string | null; merchant_name: string | null; amount: number | null; supported: number; over: number };
export type SettlementCard = {
  id: string;
  title: string;
  status: "approved" | "paid";
  approved_at: string | null;
  paid_at: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  personalCount: number;
  corporateCount: number;
  payout: number;
  payback: number;
  items: SettlementItem[]; // 사비 항목
};

export async function getMySettlements(companyId: string, memberId: string) {
  const supabase = await createClient();
  const [{ data: claims }, { data: bank }] = await Promise.all([
    supabase
      .from("expense_claims")
      .select("id, title, status, approved_at, paid_at, settlement_required")
      .eq("company_id", companyId)
      .eq("member_id", memberId)
      .or("status.eq.approved,and(status.eq.paid,settlement_required.eq.true)")
      .order("approved_at", { ascending: false })
      .limit(50),
    supabase.from("member_bank_accounts").select("id").eq("member_id", memberId).maybeSingle(),
  ]);
  const rows = claims ?? [];
  const { data: items } = rows.length
    ? await supabase
        .from("expense_items")
        .select("id, claim_id, payment_method, expense_date, merchant_name, amount, company_supported_amount, personal_burden_amount, applied_meal_limit_per_person, headcount")
        .in("claim_id", rows.map((c) => c.id))
        .order("sort_order")
    : { data: [] };
  const cards: SettlementCard[] = rows.map((c) => {
    const its = (items ?? []).filter((i) => i.claim_id === c.id);
    const personal = its.filter((i) => i.payment_method === "personal_card");
    const dates = its.map((i) => i.expense_date).filter((d): d is string => !!d).sort();
    return {
      id: c.id,
      title: c.title,
      status: c.status as "approved" | "paid",
      approved_at: c.approved_at,
      paid_at: c.paid_at,
      dateFrom: dates[0] ?? null,
      dateTo: dates[dates.length - 1] ?? null,
      personalCount: personal.length,
      corporateCount: its.length - personal.length,
      payout: personal.reduce((s, i) => s + (i.company_supported_amount ?? i.amount ?? 0), 0),
      payback: its.filter((i) => i.payment_method === "corporate_card").reduce((s, i) => s + i.personal_burden_amount, 0),
      items: personal.map((i) => ({
        id: i.id,
        expense_date: i.expense_date,
        merchant_name: i.merchant_name,
        amount: i.amount,
        supported: i.company_supported_amount ?? i.amount ?? 0,
        over: i.applied_meal_limit_per_person !== null && i.amount !== null ? Math.max(i.amount - i.applied_meal_limit_per_person * Math.max(i.headcount ?? 1, 1), 0) : 0,
      })),
    };
  });
  // 지급 시각을 한국 시간 월로 바꿔 이번 달인지 본다
  const thisMonth = currentMonthKst();
  const inMonth = (ts: string | null) => !!ts && formatDateTimeKst(ts).slice(0, 7).replace(".", "-") === thisMonth;
  return {
    cards,
    hasBank: !!bank,
    waiting: cards.filter((c) => c.status === "approved").reduce((s, c) => s + c.payout, 0),
    paidThisMonth: cards.filter((c) => c.status === "paid" && inMonth(c.paid_at)).reduce((s, c) => s + c.payout, 0),
    payback: cards.filter((c) => c.status === "approved").reduce((s, c) => s + c.payback, 0),
  };
}
