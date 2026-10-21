import "server-only";
import { createClient } from "@/lib/supabase/server";

// 정산 지급 관리 (admin-payouts.md §2·§3): 승인됐지만 지급·납부가 남은 결의서(approved), 직원별 묶음. 같은 회사만(RLS)
export type PayoutClaim = { id: string; title: string; approved_at: string | null; paid_at: string | null; payout: number; payback: number };
export type PayoutGroup = {
  member_id: string;
  name: string;
  department: string | null;
  bank: { bank_name: string; account_number: string; account_holder: string } | null;
  claims: PayoutClaim[];
  payout: number;
  payback: number;
};

export async function getPayoutGroups(companyId: string, tab: "waiting" | "paid"): Promise<PayoutGroup[]> {
  const supabase = await createClient();
  let q = supabase.from("expense_claims").select("id, title, member_id, approved_at, paid_at").eq("company_id", companyId).limit(300);
  q = tab === "waiting" ? q.eq("status", "approved").order("approved_at") : q.eq("status", "paid").eq("settlement_required", true).order("paid_at", { ascending: false });
  const { data: claims } = await q;
  const rows = claims ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.id);
  const memberIds = [...new Set(rows.map((c) => c.member_id))];
  const [{ data: items }, { data: members }, { data: banks }] = await Promise.all([
    supabase.from("expense_items").select("claim_id, payment_method, amount, company_supported_amount, personal_burden_amount").in("claim_id", ids),
    supabase.from("members").select("id, name, department_id").in("id", memberIds),
    supabase.from("member_bank_accounts").select("member_id, bank_name, account_number, account_holder").in("member_id", memberIds),
  ]);
  const deptIds = [...new Set((members ?? []).map((m) => m.department_id).filter((x): x is string => !!x))];
  const { data: depts } = deptIds.length ? await supabase.from("departments").select("id, name").in("id", deptIds) : { data: [] as { id: string; name: string }[] };
  const deptName = new Map((depts ?? []).map((d) => [d.id, d.name]));
  // 지급액 = 사비 항목 회사 지원금, 납부액 = 법인카드 항목 개인 부담 (expense-lifecycle.md §5.5, 서로 상계하지 않음)
  const sums = new Map<string, { payout: number; payback: number }>();
  for (const i of items ?? []) {
    const s = sums.get(i.claim_id) ?? { payout: 0, payback: 0 };
    if (i.payment_method === "personal_card") s.payout += i.company_supported_amount ?? i.amount ?? 0;
    else s.payback += i.personal_burden_amount;
    sums.set(i.claim_id, s);
  }
  const groups = new Map<string, PayoutGroup>();
  for (const c of rows) {
    const m = (members ?? []).find((x) => x.id === c.member_id);
    const b = (banks ?? []).find((x) => x.member_id === c.member_id);
    const g = groups.get(c.member_id) ?? {
      member_id: c.member_id,
      name: m?.name ?? "",
      department: m?.department_id ? (deptName.get(m.department_id) ?? null) : null,
      bank: b ? { bank_name: b.bank_name, account_number: b.account_number, account_holder: b.account_holder } : null,
      claims: [],
      payout: 0,
      payback: 0,
    };
    const s = sums.get(c.id) ?? { payout: 0, payback: 0 };
    g.claims.push({ id: c.id, title: c.title, approved_at: c.approved_at, paid_at: c.paid_at, ...s });
    g.payout += s.payout;
    g.payback += s.payback;
    groups.set(c.member_id, g);
  }
  return [...groups.values()];
}
