"use server";

import { refresh } from "next/cache";
import { vacationErrorText } from "@/lib/attendance/vacation";
import { createClient } from "@/lib/supabase/server";

// 휴가 종류 · 연차 부족 설정(D-241). 회사가 켜고 끈다 — 앱은 막지 않고 화면에서 법 안내를 한다. 이력은 DB 함수가 남긴다
export type LeaveTypeInput = { id?: string; name: string; deducts: boolean; paid: "paid" | "unpaid" | "partial"; allow_hours: boolean; proof: "none" | "optional" | "required"; enabled: boolean };

export async function saveLeaveTypeAction(input: LeaveTypeInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_leave_type_save", { p: input });
  if (error) return { ok: false, error: vacationErrorText(error.message) };
  refresh();
  return { ok: true };
}

export async function saveLeaveShortageAction(mode: "block" | "borrow"): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_leave_shortage_save", { p_mode: mode });
  if (error) return { ok: false, error: vacationErrorText(error.message) };
  refresh();
  return { ok: true };
}
