"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { attendanceErrorText, validateSettings, type AttendanceSettings } from "@/lib/attendance/rules";
import { newPairCode, sha256 } from "@/lib/attendance/token";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 근태 설정(D-236, spec/features/attendance.md §1·§2-1). 관리자·같은 회사·이력 남기기는 DB 함수(attendance_*)가 한다
function result(error: { message?: string } | null): ActionResult {
  if (error) return { error: attendanceErrorText(error.message) };
  refresh();
  return { error: null };
}

export async function setAttendanceEnabledAction(enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_set_enabled", { p_enabled: enabled });
  return result(error);
}

export async function saveAttendanceSettingsAction(s: AttendanceSettings): Promise<ActionResult> {
  const invalid = validateSettings(s);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_settings_save", { p: s });
  return result(error);
}

// 연결 코드: 서버가 6자리를 만들고 해시만 DB에. 코드는 이 응답으로 관리자 화면에 한 번만 보인다
export async function createPairCodeAction(name: string): Promise<{ error: string | null; code?: string; expiresAt?: string; terminalUrl?: string }> {
  const code = newPairCode();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_pair_code_create", { p_name: name.trim(), p_code_hash: sha256(code) });
  if (error) return { error: attendanceErrorText(error.message) };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { error: null, code, expiresAt: data as string, terminalUrl: `${proto}://${host}/attend/terminal` };
}

export async function renameTerminalAction(id: string, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_terminal_rename", { p_id: id, p_name: name });
  return result(error);
}

export async function revokeTerminalAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_terminal_revoke", { p_id: id });
  return result(error);
}

// 연결 코드로 단말이 붙었는지 확인(화면 새로 그림)
export async function refreshAttendanceAction(): Promise<void> {
  refresh();
}
