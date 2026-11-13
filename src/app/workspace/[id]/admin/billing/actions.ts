"use server";

import { refresh, updateTag } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { isValidSurvey } from "@/lib/feedback-survey";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";
import { BRAND } from "@/lib/brand";
import { storageErrorText } from "@/lib/billing/storage";
import { notifyFeedback } from "@/lib/feedback-desk/server";

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
  await notifyFeedback(`💾 [${BRAND.name}] 저장 공간 신청 — ${m.company_name} · ${gb === 0 ? "추가 공간 해지" : `${gb}GB`}. 운영자 화면 [저장 공간 신청]에서 처리해 주세요.`).catch(() => undefined);
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
