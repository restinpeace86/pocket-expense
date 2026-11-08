"use server";

import { requestErrorText } from "@/lib/attendance/request";
import { createClient } from "@/lib/supabase/server";

// 근태 승인 · 반려(spec/features/attendance.md §6-3, D-239). 처리 자격(관리자 신청은 대표만 등)은 DB 함수가 확인
export async function decideAttendanceRequest(id: string, approve: boolean, reason: string | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_request_decide", { p_id: id, p_approve: approve, p_reason: reason ?? "" });
  return error ? { ok: false, error: requestErrorText(error.message) } : { ok: true };
}
