"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 직원별 연차(D-240, spec/features/attendance.md §7): 확정 · 연차 설정 · 입사일 고치기. 권한·검사는 DB 함수가 한다
export type LeaveConfirmItem = { member_id: string; period_start: string; period_end: string; recommended: number | null; granted: number; reason: string | null };

function leaveErrorText(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("REASON_REQUIRED")) return "사유를 적어 주세요.";
  if (m.includes("INVALID_DAYS")) return "연차 일수는 0~60일 사이로 넣어 주세요.";
  if (m.includes("INVALID_HIRE_DATE")) return "입사일을 확인해 주세요(오늘 이후 날짜는 넣을 수 없어요).";
  if (m.includes("NO_CHANGE")) return "지금 입사일과 같아요.";
  if (m.includes("HOUR_NEEDS_HOURLY")) return "시간 단위 올림은 시간차를 켜야 고를 수 있어요.";
  if (m.includes("NOT_FOUND")) return "없거나 비활성화된 직원이에요. 새로고침해 주세요.";
  if (m.includes("NOT_ALLOWED") || m.includes("42501")) return "관리자만 바꿀 수 있어요.";
  return "저장하지 못했어요. 잠시 뒤 다시 해 주세요.";
}

export async function confirmLeaveAction(items: LeaveConfirmItem[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_leave_confirm", { p_items: items });
  if (error) return { ok: false, error: leaveErrorText(error.message) };
  refresh();
  return { ok: true };
}

export async function saveLeaveSettingsAction(hourly: boolean, rounding: "day" | "half" | "hour"): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_leave_settings_save", { p_hourly: hourly, p_rounding: rounding });
  if (error) return { ok: false, error: leaveErrorText(error.message) };
  refresh();
  return { ok: true };
}

export async function setHireDateAction(memberId: string, date: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_member_hire_date_set", { p_member: memberId, p_date: date, p_reason: reason });
  if (error) return { ok: false, error: leaveErrorText(error.message) };
  refresh();
  return { ok: true };
}
