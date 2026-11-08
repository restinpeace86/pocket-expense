"use server";

import { requestErrorText, type RequestInput } from "@/lib/attendance/request";
import { createClient } from "@/lib/supabase/server";

// 정정 신청 · 휴일 근무 상신 · 취소(spec/features/attendance.md §6, D-239). 검사·권한은 DB 함수가 한다
export type RequestActionResult = { ok: true; selfApproved: boolean } | { ok: false; error: string };

export async function createAttendanceRequest(input: RequestInput): Promise<RequestActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_request_create", {
    p_date: input.date,
    p_kind: input.kind,
    p_in: input.newIn,
    p_out: input.newOut,
    p_reason: input.reason,
  });
  if (error) return { ok: false, error: requestErrorText(error.message) };
  return { ok: true, selfApproved: (data as { self_approved?: boolean } | null)?.self_approved === true };
}

export async function cancelAttendanceRequest(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_request_cancel", { p_id: id });
  return error ? { ok: false, error: requestErrorText(error.message) } : { ok: true };
}
