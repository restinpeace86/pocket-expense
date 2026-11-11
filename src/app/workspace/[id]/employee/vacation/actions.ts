"use server";

import { vacationErrorText } from "@/lib/attendance/vacation";
import { createClient } from "@/lib/supabase/server";

// 휴가 신청·증빙·취소(D-241, spec/features/attendance.md §8). 검사·권한·알림은 DB 함수가 한다
export type LeaveCreateInput = { type_id: string; unit: "day" | "hour"; start_date: string; end_date: string; start_time: string | null; hours: number | null; reason: string | null; custom?: Record<string, string> };

export async function createLeaveAction(input: LeaveCreateInput): Promise<{ ok: true; id: string; status: string; selfApproved: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_leave_create", { p: input });
  if (error || !data) return { ok: false, error: vacationErrorText(error?.message) };
  const d = data as { id: string; status: string; self_approved: boolean };
  return { ok: true, id: d.id, status: d.status, selfApproved: d.self_approved };
}

export async function addLeaveFileAction(leaveId: string, path: string, name: string, mime: string, size: number, consent: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_leave_file_add", { p_leave: leaveId, p_path: path, p_name: name, p_mime: mime, p_size: size, p_consent: consent });
  if (error) {
    await supabase.storage.from("leave-proofs").remove([path]); // 등록 못 한 파일은 바로 지운다
    return { ok: false, error: vacationErrorText(error.message) };
  }
  return { ok: true };
}

export async function removeLeaveFileAction(fileId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_leave_file_remove", { p_file: fileId });
  if (error) return { ok: false, error: vacationErrorText(error.message) };
  if (typeof data === "string") await supabase.storage.from("leave-proofs").remove([data]);
  return { ok: true };
}

export async function cancelLeaveAction(id: string, reason: string | null): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_leave_cancel", { p_id: id, p_reason: reason ?? "" });
  if (error) return { ok: false, error: vacationErrorText(error.message) };
  return { ok: true, result: String(data) };
}
