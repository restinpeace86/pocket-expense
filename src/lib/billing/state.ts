// 요금제 화면이 받는 정기결제 상태(D-298, DB public.billing_state)
export type BillingSubscription = {
  customer_key: string;
  plan_code: string;
  storage_gb: number;
  status: "pending" | "scheduled" | "active" | "past_due" | "canceled";
  card_label: string | null;
  next_billing_on: string | null;
  period_start: string | null;
  period_end: string | null;
  pending_plan_code: string | null;
  pending_storage_gb: number | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  cancel_reason: "user" | "unpaid" | null;
};
export type BillingPayment = {
  id: string;
  kind: "first" | "renewal" | "retry";
  plan_code: string;
  storage_gb: number;
  total: number;
  supply: number;
  vat: number;
  coupon: boolean;
  status: "paid" | "failed";
  fail_message: string | null;
  period_start: string | null;
  period_end: string | null;
  receipt_url: string | null;
  created_at: string;
};
export type BillingState = { open: boolean; blocked: boolean; today: string; subscription: BillingSubscription | null; payments: BillingPayment[] };

export const SUBSCRIBED = ["scheduled", "active", "past_due"] as const;
export const isSubscribed = (s: BillingSubscription | null | undefined) => !!s && (SUBSCRIBED as readonly string[]).includes(s.status);

export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export const mdKo = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

// 결제 실패 일정(사용자 결정 2026-11-20): 1~3일 재시도 · 7일까지 유예 · 8일째 업로드 멈춤 · 30일 해지
export function pastDueSchedule(since: string) {
  return { retryUntil: addDays(since, 3), graceUntil: addDays(since, 7), blockFrom: addDays(since, 8), cancelOn: addDays(since, 30) };
}
