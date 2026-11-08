import "server-only";
import { createHmac } from "node:crypto";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LeaveAdminData } from "./leave";
import type { Leave, VacationData } from "./vacation";
import type { AttendanceSettings } from "./rules";

// 근태(D-236) 서버 공통

// QR 서명 비밀키: 서버 전용 service role 키에서 용도별로 뽑는다(별도 환경변수 없이, 브라우저로 나가지 않음)
export function qrSecret(): string | null {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) return null;
  return createHmac("sha256", base).update("attendance-qr-v1").digest("hex");
}

export const attendanceEnabled = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_feature_enabled", { p_feature: "attendance" });
  return data === true;
});

export type AttendanceToday = { in_at?: string; out_at?: string | null; out_method?: "qr" | "auto" | null; holiday?: boolean };
// null = 근태 꺼짐, {} = 아직 출근 전
export const getMyAttendanceToday = cache(async (): Promise<AttendanceToday | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_attendance_today");
  return (data as AttendanceToday | null) ?? null;
});

export type AttendanceTerminal = { id: string; name: string; created_at: string; last_used_at: string | null; created_by: string | null };
export type AttendanceHistoryRow = { id: number; at: string; member_name: string | null; action: string; changes: { label: string; from: string | null; to: string | null; reason?: string | null }[] };
export type AttendanceAdminView = { enabled: boolean; settings: AttendanceSettings; terminals: AttendanceTerminal[]; history: AttendanceHistoryRow[] };

export async function getAttendanceAdminView(): Promise<AttendanceAdminView> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_admin_view");
  if (error || !data) throw new Error(error?.message ?? "attendance_admin_view");
  return data as unknown as AttendanceAdminView;
}

// 관리자 메뉴 [근태 승인] 숫자(D-239): 근태 꺼짐이면 null(메뉴 숨김), 켜짐이면 내가 처리할 수 있는 대기 건수
export const attendancePendingCount = cache(async (): Promise<number | null> => {
  if (!(await attendanceEnabled())) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("attendance_pending_count");
  return typeof data === "number" ? data : 0;
});

export type AdminRequest = {
  id: string;
  member_name: string;
  member_role: "employee" | "admin" | "super_admin";
  work_date: string;
  kind: "correction" | "holiday";
  new_in: string;
  new_out: string;
  reason: string;
  before: { in_at?: string; out_at?: string | null; out_method?: string | null };
  status: "pending" | "approved" | "rejected";
  self_approved: boolean;
  decided_by_name: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  created_at: string;
  mine: boolean;
  can_decide: boolean;
};
export async function getAttendanceRequestsAdmin(): Promise<{ pending: AdminRequest[]; done: AdminRequest[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_requests_admin");
  if (error || !data) throw new Error(error?.message ?? "attendance_requests_admin");
  return data as unknown as { pending: AdminRequest[]; done: AdminRequest[] };
}

// 직원별 연차(D-240)
export async function getLeaveAdmin(year: number): Promise<LeaveAdminData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_leave_admin", { p_year: year });
  if (error || !data) throw new Error(error?.message ?? "attendance_leave_admin");
  return data as unknown as LeaveAdminData;
}
// 근태 켠 회사에서 입사일이 비었는지(홈 안내 한 번)
export const myHireDateMissing = cache(async (): Promise<boolean> => {
  if (!(await attendanceEnabled())) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_hire_date");
  return !error && !data;
});

// 휴가(D-241)
export async function getMyVacation(year: number): Promise<VacationData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_vacation", { p_year: year });
  if (error || !data) throw new Error(error?.message ?? "my_vacation");
  return data as unknown as VacationData;
}
export type LeaveTypeRow = { id: string; builtin_key: string | null; name: string; law_ref: string | null; deducts: boolean; paid: "paid" | "unpaid" | "partial"; allow_hours: boolean; proof: "none" | "optional" | "required"; proof_locked: boolean; enabled: boolean; sort: number };
export type LeaveTypesAdmin = { types: LeaveTypeRow[]; shortage: "block" | "borrow"; hourly_leave: boolean; under_five: boolean; used: string[] };
export async function getLeaveTypesAdmin(): Promise<LeaveTypesAdmin> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_leave_types_list");
  if (error || !data) throw new Error(error?.message ?? "attendance_leave_types_list");
  return data as unknown as LeaveTypesAdmin;
}
export async function getLeavesAdmin(): Promise<{ pending: Leave[]; done: Leave[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_leaves_admin");
  if (error || !data) throw new Error(error?.message ?? "attendance_leaves_admin");
  return data as unknown as { pending: Leave[]; done: Leave[] };
}

export function clientIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}
