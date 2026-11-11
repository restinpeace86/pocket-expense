import { addDays, daysLabel } from "./leave";
import { dayLabel } from "./month";

// 휴가 신청·취소(spec/features/attendance.md §8, D-241) — 순수 함수
export type VacationType = { id: string; key: string | null; name: string; deducts: boolean; paid: "paid" | "unpaid" | "partial"; allow_hours: boolean; proof: "none" | "optional" | "required" };
export type LeaveFile = { id: string; name: string; mime: string; size: number; path: string | null; purged: boolean };
export type Leave = {
  id: string;
  member_id: string;
  member_name: string;
  member_role: "employee" | "admin" | "super_admin";
  type_id: string;
  type_name: string;
  deducts: boolean;
  proof: "none" | "optional" | "required";
  unit: "day" | "hour";
  start_date: string;
  end_date: string;
  start_time: string | null;
  hours: number | null;
  workdays: number;
  deduct_days: number;
  period_start: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  self_approved: boolean;
  decided_by_name: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  cancel_status: "pending" | "approved" | "rejected" | null;
  cancel_reason: string | null;
  cancel_requested_at: string | null;
  cancel_decided_by_name: string | null;
  cancel_decided_at: string | null;
  cancel_reject_reason: string | null;
  created_at: string;
  can_decide?: boolean;
  mine?: boolean;
  has_proof: boolean;
  form_id?: string | null; // 회사 휴가신청서 양식으로 낸 휴가(8-104 C)
  files: LeaveFile[];
  granted: number | null;
  used_other: number | null;
};
export type Grant = { period_start: string; period_end: string; granted: number; used: number; approved: number };
export type VacationData = {
  year: number;
  today: string;
  settings: { hourly_leave: boolean; daily_hours: number; shortage: "block" | "borrow"; work_days: number[] };
  types: VacationType[];
  grants: Grant[];
  leaves: Leave[];
  holidays: string[];
};

export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PROOF_MAX_FILES = 5;
export const PAID_LABEL: Record<VacationType["paid"], string> = { paid: "유급", unpaid: "무급", partial: "일부 유급" };

const isoDow = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

// 근무일 세기(근무 요일·공휴일 제외)
export function workdaysBetween(start: string, end: string, workDays: number[], holidays: Set<string>): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (workDays.includes(isoDow(d)) && !holidays.has(d)) n++;
  return n;
}
// 근무일이 아니라 빠진 날(주말·공휴일) — 미리 보기 안내용
export function skippedDays(start: string, end: string, workDays: number[], holidays: Set<string>): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (!workDays.includes(isoDow(d)) || holidays.has(d)) out.push(d);
  return out;
}

export function grantFor(grants: Grant[], date: string): Grant | null {
  return [...grants].sort((a, b) => b.period_start.localeCompare(a.period_start)).find((g) => g.period_start <= date && g.period_end >= date) ?? null;
}

export type VacationInput = { typeId: string; unit: "day" | "hour"; start: string; end: string; startTime: string; hours: number; reason: string };
export type Preview = { workdays: number; deduct: number; skipped: string[]; grant: Grant | null; remainingBefore: number | null; remainingAfter: number | null; error: string | null };

export function preview(data: VacationData, input: VacationInput, monthStart: string): Preview {
  const type = data.types.find((t) => t.id === input.typeId);
  const holidays = new Set(data.holidays);
  const { work_days: workDays, daily_hours: h } = data.settings;
  const end = input.unit === "hour" ? input.start : input.end || input.start;
  const base: Preview = { workdays: 0, deduct: 0, skipped: [], grant: null, remainingBefore: null, remainingAfter: null, error: null };
  if (!type) return { ...base, error: "종류를 골라 주세요." };
  if (!input.start) return { ...base, error: "날짜를 골라 주세요." };
  if (end < input.start) return { ...base, error: "끝나는 날이 시작하는 날보다 빨라요." };
  if (input.start < monthStart) return { ...base, error: "지난 날짜는 이번 달까지만 신청할 수 있어요." };
  const workdays = workdaysBetween(input.start, end, workDays, holidays);
  const skipped = skippedDays(input.start, end, workDays, holidays);
  if (!workdays) return { ...base, skipped, error: "고른 날짜에 근무일이 없어요(주말·공휴일)." };
  if (input.unit === "hour") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return { ...base, workdays, skipped, error: "시작 시각을 골라 주세요." };
    if (!(input.hours >= 1 && input.hours < h)) return { ...base, workdays, skipped, error: `시간은 1~${h - 1}시간으로 골라 주세요(하루면 '하루 이상'으로).` };
  }
  const deduct = type.deducts ? (input.unit === "hour" ? Math.round((input.hours / h) * 1000) / 1000 : workdays) : 0;
  if (!type.deducts) return { ...base, workdays, skipped, deduct };
  const grant = grantFor(data.grants, input.start);
  if (!grant) return { ...base, workdays, skipped, deduct, error: "회사가 아직 이 기간 연차를 확정하지 않았어요. 관리자에게 알려 주세요." };
  if (end > grant.period_end) return { ...base, workdays, skipped, deduct, grant, error: `연차 기간(${grant.period_end}까지)을 넘어가요. 나눠서 신청해 주세요.` };
  const before = Math.round((grant.granted - grant.used) * 1000) / 1000;
  const after = Math.round((before - deduct) * 1000) / 1000;
  const error = after < -1e-9 && data.settings.shortage === "block" ? `남은 연차(${daysLabel(Math.max(before, 0), h)})가 모자라요.` : null;
  return { workdays, deduct, skipped, grant, remainingBefore: before, remainingAfter: after, error };
}

// "12/24 (목) ~ 12/26 (토)" · "11/20 (금) 14:00부터 4시간"
export function leaveDateLabel(l: Pick<Leave, "start_date" | "end_date" | "unit" | "start_time" | "hours">): string {
  const d = l.end_date > l.start_date ? `${dayLabel(l.start_date)} ~ ${dayLabel(l.end_date)}` : dayLabel(l.start_date);
  return l.unit === "hour" ? `${d} ${l.start_time}부터 ${l.hours}시간` : d;
}
export function leaveAmountLabel(l: Pick<Leave, "unit" | "workdays" | "hours" | "deducts" | "deduct_days">, dailyHours: number): string {
  const amount = l.unit === "hour" ? `${l.hours}시간` : `근무일 ${l.workdays}일`;
  return l.deducts ? `${amount} · 연차 ${daysLabel(l.deduct_days, dailyHours)}` : `${amount} · 연차 차감 없음`;
}

export type LeaveBadge = { text: string; cls: string; key: string };
export function leaveBadge(l: Pick<Leave, "status" | "cancel_status" | "proof" | "has_proof">): LeaveBadge {
  if (l.status === "pending") return l.proof === "required" && !l.has_proof ? { key: "proof", text: "증빙 기다리는 중", cls: "bg-orange-100 text-orange-800" } : { key: "pending", text: "승인 대기", cls: "bg-amber-100 text-amber-900" };
  if (l.status === "approved" && l.cancel_status === "pending") return { key: "cancel_pending", text: "승인 · 취소 신청 중", cls: "bg-indigo-100 text-indigo-800" };
  if (l.status === "approved") return { key: "approved", text: "승인", cls: "bg-green-100 text-green-800" };
  if (l.status === "rejected") return { key: "rejected", text: "반려", cls: "bg-zinc-200 text-zinc-800" };
  return { key: "canceled", text: l.cancel_status === "approved" ? "취소됨(연차 돌려받음)" : "취소됨", cls: "bg-zinc-100 text-zinc-600" };
}

// 이 해의 연차 요약(그 해에 시작하는 연차 기간 중 오늘이 들어가는 것, 없으면 첫 기간)
export function yearSummary(data: VacationData): { grant: Grant | null; remaining: number | null; pending: number } {
  const grant = grantFor(data.grants, data.today >= `${data.year}-01-01` && data.today <= `${data.year}-12-31` ? data.today : `${data.year}-01-01`) ?? data.grants[0] ?? null;
  if (!grant) return { grant: null, remaining: null, pending: 0 };
  return { grant, remaining: Math.round((grant.granted - grant.used) * 1000) / 1000, pending: Math.round((grant.used - grant.approved) * 1000) / 1000 };
}

export function vacationErrorText(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("TYPE_OFF")) return "회사에서 쓰지 않는 휴가 종류예요.";
  if (m.includes("OUT_OF_RANGE")) return "지난 날짜는 이번 달까지만 신청·취소할 수 있어요.";
  if (m.includes("HOURS_OFF")) return "이 휴가는 시간 단위로 쓸 수 없어요.";
  if (m.includes("INVALID_HOURS")) return "시간을 다시 골라 주세요(하루보다 짧게).";
  if (m.includes("NO_WORKDAY")) return "고른 날짜에 근무일이 없어요(주말·공휴일).";
  if (m.includes("OVERLAP")) return "이미 신청했거나 승인된 휴가와 날짜가 겹쳐요.";
  if (m.includes("NO_GRANT")) return "회사가 아직 이 기간 연차를 확정하지 않았어요. 관리자에게 알려 주세요.";
  if (m.includes("CROSS_PERIOD")) return "연차 기간을 넘어가요. 나눠서 신청해 주세요.";
  if (m.includes("NOT_ENOUGH")) return "남은 연차가 모자라요.";
  if (m.includes("CUSTOM_REQUIRED")) return "회사 추가 항목 중 필수 칸을 채워 주세요.";
  if (m.includes("CUSTOM_INVALID")) return "회사 추가 항목 값을 다시 확인해 주세요.";
  if (m.includes("CONSENT_REQUIRED")) return "민감정보 수집·이용에 동의해야 증빙을 올릴 수 있어요.";
  if (m.includes("FILE_LIMIT")) return `증빙은 ${PROOF_MAX_FILES}개까지 올릴 수 있어요.`;
  if (m.includes("PROOF_REQUIRED")) return "증빙이 아직 없어서 승인할 수 없어요.";
  if (m.includes("REASON_REQUIRED")) return "반려 사유를 적어 주세요.";
  if (m.includes("ALREADY_DECIDED")) return "이미 처리된 신청이에요. 새로고침해 주세요.";
  if (m.includes("ANNUAL_LOCKED")) return "연차는 항상 켜져 있고 바꿀 수 없어요.";
  if (m.includes("NAME_LENGTH")) return "이름은 1~30자로 적어 주세요.";
  if (m.includes("TYPE_LIMIT")) return "휴가 종류는 40개까지 만들 수 있어요.";
  if (m.includes("NOT_FOUND")) return "없거나 이미 처리된 휴가예요. 새로고침해 주세요.";
  if (m.includes("NOT_ALLOWED") || m.includes("42501")) return "이 휴가는 처리할 수 없어요.";
  if (m.includes("FEATURE_DISABLED")) return "회사에서 근태를 쓰지 않아요.";
  return "처리하지 못했어요. 잠시 뒤 다시 해 주세요.";
}

// 증빙 파일 경로(저장소 정책: {company}/{member}/{leave}/{파일})
export function proofPath(companyId: string, memberId: string, leaveId: string, ext: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${companyId}/${memberId}/${leaveId}/${Date.now()}-${rand}.${ext}`;
}
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;
}
