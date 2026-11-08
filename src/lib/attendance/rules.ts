// 근태 화면 공통 규칙 (spec/features/attendance.md, D-236) — 순수 함수만
export const OPEN_HOUR = 6; // QR은 한국 시간 06:00~24:00
export const ALERT_OPTIONS = [30, 60, 90, 120, 180] as const;
export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const; // ISO 1~7

export type AttendanceSettings = {
  work_start: string;
  work_end: string;
  daily_hours: number;
  work_days: number[];
  missing_alert_minutes: number;
  leave_year_basis: "calendar" | "hire";
  under_five: boolean;
};

export function kstHour(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).format(now));
}
export const isOpenHour = (now: Date = new Date()) => kstHour(now) >= OPEN_HOUR;

export function kstTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

// 머문 시간: "9시간 15분" / "40분" / "0분"
export function stayLabel(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

// 10분 단위 시각 목록(00:00~23:50)
export const TIME_OPTIONS = Array.from({ length: 144 }, (_, i) => `${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}`);

// "정규 퇴근 1시간 뒤 (19:00)" — 자정을 넘기면 23:50
export function alertLabel(workEnd: string, minutes: number): string {
  const [h, m] = workEnd.split(":").map(Number);
  const at = Math.min(h * 60 + m + minutes, 23 * 60 + 50);
  const span = minutes % 60 ? (minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`) : `${minutes / 60}시간`;
  return `정규 퇴근 ${span} 뒤 (${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")})`;
}

export function validateSettings(s: AttendanceSettings): string | null {
  if (!TIME_OPTIONS.includes(s.work_start) || !TIME_OPTIONS.includes(s.work_end)) return "시각은 10분 단위로 골라 주세요.";
  if (s.work_start >= s.work_end) return "정규 퇴근은 출근보다 늦어야 해요(자정 넘는 근무는 지원하지 않아요).";
  if (!Number.isInteger(s.daily_hours) || s.daily_hours < 1 || s.daily_hours > 12) return "1일 소정근로시간은 1~12시간이에요.";
  if (!s.work_days.length || s.work_days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return "근무 요일을 하나 이상 골라 주세요.";
  if (!(ALERT_OPTIONS as readonly number[]).includes(s.missing_alert_minutes)) return "퇴근 누락 알림 시간을 골라 주세요.";
  return null;
}

// DB 오류 → 안내 문구
export function attendanceErrorText(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("WORK_TIME_ORDER")) return "정규 퇴근은 출근보다 늦어야 해요.";
  if (m.includes("TERMINAL_LIMIT")) return "출근 단말은 20대까지 등록할 수 있어요. 안 쓰는 단말을 해제해 주세요.";
  if (m.includes("NAME_LENGTH")) return "이름은 1~30자로 적어 주세요.";
  if (m.includes("FEATURE_DISABLED")) return "근태를 먼저 켜 주세요.";
  if (m.includes("NOT_FOUND")) return "이미 해제됐거나 없는 단말이에요. 새로고침해 주세요.";
  if (m.includes("NOT_ALLOWED") || m.includes("42501")) return "관리자만 바꿀 수 있어요.";
  return "저장하지 못했어요. 잠시 뒤 다시 해 주세요.";
}
