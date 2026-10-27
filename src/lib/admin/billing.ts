import "server-only";
import { creditEventAmount, creditEventEnabled } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

// 요금제 화면 A-05 데이터 (spec/screens/admin-billing.md, pricing-policy.md §2·§4·§5). 자기 회사만(RLS).
export type BillingPlan = {
  code: string;
  name: string;
  monthly_price: number;
  monthly_receipts: number;
  recommended_size: string | null;
  is_featured: boolean;
};

export type CreditStatus = {
  granted: number;
  used: number;
  freeTrial: number; // 처음 무료 지급 장수
  eventCount: number; // 이벤트 추가 지급 횟수
  eventTotal: number; // 이벤트로 받은 장수 합계
  eventEnabled: boolean;
  eventAmount: number;
  showEventBanner: boolean; // 이벤트 지급 뒤 아직 [확인]하지 않음
};

export async function getCreditStatus(companyId: string): Promise<CreditStatus | null> {
  const supabase = await createClient();
  const [{ data: company }, { data: ledger }] = await Promise.all([
    supabase.from("companies").select("receipt_credits_granted, receipt_credits_used, last_event_bonus_at, event_bonus_acknowledged_at").eq("id", companyId).maybeSingle(),
    supabase.from("credit_ledger").select("reason, delta").eq("company_id", companyId).in("reason", ["free_trial_grant", "event_bonus"]),
  ]);
  if (!company) return null;
  const rows = ledger ?? [];
  const events = rows.filter((r) => r.reason === "event_bonus");
  const last = company.last_event_bonus_at;
  const ack = company.event_bonus_acknowledged_at;
  return {
    granted: company.receipt_credits_granted,
    used: company.receipt_credits_used,
    freeTrial: rows.filter((r) => r.reason === "free_trial_grant").reduce((s, r) => s + r.delta, 0),
    eventCount: events.length,
    eventTotal: events.reduce((s, r) => s + r.delta, 0),
    eventEnabled: creditEventEnabled(),
    eventAmount: creditEventAmount(),
    showEventBanner: !!last && (!ack || ack < last),
  };
}

// 추가 크레딧 상품(D-133): 남은 장수가 0일 때만 화면에 보인다
export type BillingAddon = { code: string; name: string; receipts: number; price: number };

export async function getBillingAddons(): Promise<BillingAddon[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("billing_addons").select("code, name, receipts, price").order("sort_order");
  return data ?? [];
}

export async function getBillingPlans(): Promise<BillingPlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_plans")
    .select("code, name, monthly_price, monthly_receipts, recommended_size, is_featured")
    .order("sort_order");
  return data ?? [];
}
