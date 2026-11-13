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
  max_members: number | null; // null = 제한 없음(D-198)
  chat_storage_mb: number | null; // 사내 채팅 첨부 저장 한도(D-204)
  vault_storage_mb: number | null; // 파일 영구 보관 한도(D-245)
  monthly_doc_converts: number | null; // 서류 → 엑셀 변환 월 무료 횟수(D-265)
  doc_converts_unlimited: boolean; // 비즈니스 무제한*(공정 사용 기준 = monthly_doc_converts)
  trash_days: number | null; // 파일 보관함 휴지통 복구 기간(D-266)
  storage_mb?: number | null; // 회사 공용 저장 공간(D-271, migration 158 뒤 조회)
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
  surveyDone: boolean; // 후기·설문을 이미 남김(회사당 1회, D-130)
  coupon: boolean; // 후기 쿠폰이 있고 아직 결제한 적 없음 → 첫 결제 50% 할인(D-201)
  trialEndsOn: string | null; // 무료 이용 종료일 = 가입한 달 + 다음 달 세무 마감일(D-201)
};

export async function getCreditStatus(companyId: string): Promise<CreditStatus | null> {
  const supabase = await createClient();
  const [{ data: company }, { data: ledger }, { data: survey }] = await Promise.all([
    supabase.from("companies").select("receipt_credits_granted, receipt_credits_used, last_event_bonus_at, event_bonus_acknowledged_at, first_purchase_at, review_coupon_at, trial_ends_on").eq("id", companyId).maybeSingle(),
    supabase.from("credit_ledger").select("reason, delta").eq("company_id", companyId).in("reason", ["free_trial_grant", "event_bonus", "survey_bonus"]),
    supabase.from("feedback_surveys").select("id").eq("company_id", companyId).maybeSingle(),
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
    surveyDone: !!survey || rows.some((r) => r.reason === "survey_bonus"),
    coupon: !!company.review_coupon_at && !company.first_purchase_at,
    trialEndsOn: company.trial_ends_on,
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
    .select("code, name, monthly_price, monthly_receipts, recommended_size, is_featured, max_members, chat_storage_mb, vault_storage_mb, monthly_doc_converts, doc_converts_unlimited, trash_days")
    .order("sort_order");
  return data ?? [];
}
