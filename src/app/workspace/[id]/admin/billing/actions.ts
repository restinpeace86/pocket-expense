"use server";

import { refresh, updateTag } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { isValidSurvey } from "@/lib/feedback-survey";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

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

// 후기·설문 제출 → +100 크레딧(회사당 1회, D-130). 권한·1회·지급은 DB 함수 submit_feedback_survey가 한 트랜잭션에서 확인한다.
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
