"use server";

import { refresh, updateTag } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { isValidSurvey } from "@/lib/feedback-survey";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";
import { storageErrorText } from "@/lib/billing/storage";
import { notifyOps } from "@/lib/ops-notify/server";
import { chargeCompany, tossReady } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 이벤트 추가 지급 배너 [확인] (pricing-policy.md §5). 관리자 이상, 자기 회사만(RLS companies_update).
export async function acknowledgeEventBonusAction(): Promise<ActionResult> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .update({ event_bonus_acknowledged_at: new Date().toISOString() })
    .eq("id", m.company_id)
    .select("id");
  if (error) return { error: messageForDbError(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_ALLOWED" }) };
  refresh();
  return { error: null };
}

export type SurveyInput = { rating: number; usefulFeature: string; industry: string; companySize: string; jobRole: string; review: string; displayConsent: boolean };

// 후기·설문 제출 → 첫 결제 50% 할인 쿠폰(회사당 1회, D-130 → D-201). 권한·1회·지급은 DB 함수 submit_feedback_survey가 한 트랜잭션에서 확인한다.
export async function submitFeedbackSurveyAction(input: SurveyInput): Promise<{ error: string | null; left?: number }> {
  if (!isValidSurvey(input)) return { error: messageForDbError({ message: "INVALID_SURVEY" }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_feedback_survey", {
    p_rating: input.rating,
    p_useful_feature: input.usefulFeature,
    p_industry: input.industry,
    p_company_size: input.companySize,
    p_job_role: input.jobRole,
    p_review: input.review.trim(),
    p_display_consent: input.displayConsent,
  });
  if (error) return { error: messageForDbError(error) };
  const m = await getMembership();
  if (m) notifyOps({ kind: "review", company: m.company_name, rating: input.rating, review: input.review });
  if (input.displayConsent && input.review.trim()) updateTag("testimonials"); // 랜딩 후기에 바로 반영
  refresh();
  return { error: null, left: data ?? undefined };
}

// 저장 공간 추가 신청(8-103, D-262): 결제가 붙을 때까지는 신청 → 운영자가 켜 줌(무료). gb = 바라는 추가 공간(0 = 해지)
export async function requestStorageAction(gb: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: storageErrorText("NOT_ALLOWED") };
  if (!Number.isInteger(gb) || gb < 0 || gb > 1000) return { ok: false, error: storageErrorText("NO_SUCH_ADDON") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("storage_addon_request", { p_gb: gb });
  if (error) return { ok: false, error: storageErrorText(error.message) };
  // 운영자 알림(회사명·상품만)
  notifyOps({ kind: "storage", company: m.company_name, gb });
  refresh();
  return { ok: true };
}

// 처리 전 신청 취소
export async function withdrawStorageAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: storageErrorText("NOT_ALLOWED") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("storage_addon_withdraw");
  if (error) return { ok: false, error: "취소하지 못했어요. 잠시 후 다시 시도해 주세요." };
  refresh();
  return { ok: true };
}

// ── 정기결제(D-298) ─────────────────────────────────────────────────────────
const BILLING_ERRORS: Record<string, string> = {
  BILLING_CLOSED: "아직 결제가 열리지 않은 회사예요.",
  INVALID_PLAN: "요금제나 저장 공간을 다시 골라 주세요.",
  NO_SUBSCRIPTION: "구독 정보가 없어요. 새로고침해 주세요.",
  PAST_DUE_CANCEL: "밀린 결제가 있어요. 카드를 바꿔 결제한 뒤 해지할 수 있어요.",
};
const billingError = (code: string) => BILLING_ERRORS[Object.keys(BILLING_ERRORS).find((k) => code.includes(k)) ?? ""] ?? messageForDbError({ message: code });

async function billingAdmin() {
  const m = await getMembership();
  return m && m.status === "approved" && isAdminRole(m.role) ? m : null;
}

// 결제하기/카드 바꾸기: 고른 구성을 저장하고 토스 카드 등록창에 넘길 값을 돌려준다(비밀 키는 주지 않음)
export async function prepareBillingAction(plan: string, gb: number): Promise<{ ok: true; customerKey: string; clientKey: string; customerName: string } | { ok: false; error: string }> {
  const m = await billingAdmin();
  if (!m) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey || !process.env.TOSS_SECRET_KEY) return { ok: false, error: "결제 설정이 아직 안 됐어요. 잠시 후 다시 시도해 주세요." };
  if (typeof plan !== "string" || plan.length > 30 || !Number.isInteger(gb)) return { ok: false, error: billingError("INVALID_PLAN") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_prepare", { p_plan: plan, p_storage: gb });
  if (error || !data) return { ok: false, error: billingError(error?.message ?? "") };
  return { ok: true, customerKey: data, clientKey, customerName: m.company_name.slice(0, 50) };
}

// 구성 바꾸기(첫 결제 전이면 바로, 결제 중이면 다음 결제일부터)
export async function changeBillingAction(plan: string, gb: number): Promise<{ ok: true; when: string } | { ok: false; error: string }> {
  const m = await billingAdmin();
  if (!m) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  if (typeof plan !== "string" || plan.length > 30 || !Number.isInteger(gb)) return { ok: false, error: billingError("INVALID_PLAN") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_change", { p_plan: plan, p_storage: gb });
  if (error) return { ok: false, error: billingError(error.message) };
  refresh();
  return { ok: true, when: data ?? "next" };
}

// 해지 신청/취소
export async function setBillingCancelAction(cancel: boolean): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  const m = await billingAdmin();
  if (!m) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_set_cancel", { p_cancel: cancel === true });
  if (error) return { ok: false, error: billingError(error.message) };
  refresh();
  return { ok: true, result: data ?? "" };
}

// 밀린 결제를 지금 다시(등록된 카드로)
export async function payNowAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await billingAdmin();
  if (!m) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  const { data: state } = await supabase.rpc("billing_state");
  const status = (state as { subscription?: { status: string } | null } | null)?.subscription?.status;
  if (status !== "past_due") return { ok: false, error: "지금 다시 결제할 내용이 없어요." };
  const admin = createAdminClient();
  if (!admin || !tossReady()) return { ok: false, error: "결제 설정이 아직 안 됐어요." };
  const r = await chargeCompany(admin, m.company_id, "retry");
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.message };
}
