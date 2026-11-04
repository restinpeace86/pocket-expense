"use server";

import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/session";
import { saveErrorText } from "@/lib/calendar/calendar";
import { createClient } from "@/lib/supabase/server";

// 일정 → 경비 올리기(D-210): 일정 정보가 채워진 결의서(작성 중)를 만들고 편집 화면으로.
// 참석자(불참 제외)·출장·회의 일정·같은 회사·캘린더 켜짐 확인은 DB 함수(calendar_create_claim)가 한다
export async function createClaimFromEventAction(eventId: string): Promise<{ error: string } | never> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: saveErrorText("NOT_A_MEMBER") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_create_claim", { p_event_id: eventId });
  if (error || !data) return { error: saveErrorText(error?.message) };
  redirect(`/workspace/${membership.company_id}/employee/claims/${data}/edit?add=1`);
}
