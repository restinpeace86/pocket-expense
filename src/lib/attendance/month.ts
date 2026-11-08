import { kstTime, stayLabel } from "./rules";

// 월 근태 현황 계산(spec/features/attendance.md §5 D-237, §6 D-239) — 순수 함수
export type MonthDay = {
  work_date: string;
  in_at: string;
  out_at: string | null;
  in_method?: "qr" | "correction";
  out_method: "qr" | "auto" | "correction" | null;
  holiday: boolean;
  holiday_approved?: boolean;
  sched_end: string;
  in_terminal: string | null;
  out_terminal: string | null;
};
export type RequestBefore = { in_at?: string; out_at?: string | null; in_method?: string; out_method?: string | null };
export type AttendanceRequest = {
  id: string;
  work_date: string;
  kind: "correction" | "holiday";
  new_in: string;
  new_out: string;
  reason: string;
  before: RequestBefore;
  status: "pending" | "approved" | "rejected";
  self_approved: boolean;
  decided_by_name: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  created_at: string;
};
export type MonthData = {
  month: string;
  today: string;
  since: string;
  request_from?: string;
  work_days: number[];
  holidays: { day: string; name: string }[];
  days: MonthDay[];
  requests?: AttendanceRequest[];
};

export type RowKind = "plain" | "auto" | "holiday" | "open" | "noout" | "none" | "before";
// 목록 표시: 신청 상태가 있으면 그것을 먼저
export type RowBadge = RowKind | "pending" | "holidayPending" | "holidayApproved" | "holidayRejected" | "rejected" | "corrected";
export type MonthRow = {
  date: string;
  label: string; // "11/19 (수)"
  dayTone: "weekday" | "sat" | "red";
  holidayName: string | null;
  kind: RowKind;
  badge: RowBadge;
  inTime: string | null;
  outTime: string | null;
  stay: string | null;
  record: MonthDay | null;
  pending: AttendanceRequest | null;
  lastRejected: AttendanceRequest | null; // 가장 최근 처리가 반려일 때만
  changes: AttendanceRequest[]; // 승인된 신청(바뀐 기록)
  canCorrect: boolean;
  canHoliday: boolean;
  pastMonth: boolean; // 이번 달이 아니라 정정할 수 없음
};
export type MonthSummary = { worked: number; holidayWorked: number; holidayWaiting: number; minutes: number; auto: number; missing: number; pending: number; rejected: number };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const isoDow = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1=월 … 7=일

export function dayLabel(date: string): string {
  const [, mm, dd] = date.split("-");
  return `${Number(mm)}/${Number(dd)} (${WEEK[isoDow(date) % 7]})`;
}
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
export function lastDayOf(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}
// 말일 주의 안내: 이번 달 마지막 3일(D-239)
export function monthEndNotice(today: string): string | null {
  const last = lastDayOf(today.slice(0, 7));
  return today >= addDays(last, -2) ? dayLabel(last) : null;
}

export function buildMonth(data: MonthData, now: Date = new Date()): { rows: MonthRow[]; summary: MonthSummary } {
  const start = `${data.month}-01`;
  const next = `${shiftMonth(data.month, 1)}-01`;
  const last = data.today < next ? data.today : addDays(next, -1);
  const byDate = new Map(data.days.map((d) => [d.work_date, d]));
  const holidays = new Map(data.holidays.map((h) => [h.day, h.name]));
  const requestFrom = data.request_from ?? null;
  const reqs = new Map<string, AttendanceRequest[]>();
  for (const r of [...(data.requests ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    reqs.set(r.work_date, [...(reqs.get(r.work_date) ?? []), r]);
  }
  const rows: MonthRow[] = [];
  const summary: MonthSummary = { worked: 0, holidayWorked: 0, holidayWaiting: 0, minutes: 0, auto: 0, missing: 0, pending: 0, rejected: 0 };

  for (let date = last; date >= start; date = addDays(date, -1)) {
    const dow = isoDow(date);
    const holidayName = holidays.get(date) ?? null;
    const workday = data.work_days.includes(dow) && !holidayName;
    const rec = byDate.get(date) ?? null;
    const label = dayLabel(date);
    const dayTone = holidayName || dow === 7 ? "red" : dow === 6 ? "sat" : "weekday";
    const list = reqs.get(date) ?? [];
    const pending = list.find((r) => r.status === "pending") ?? null;
    const decided = list.filter((r) => r.status !== "pending");
    const latest = decided[decided.length - 1] ?? null;
    const lastRejected = !pending && latest?.status === "rejected" ? latest : null;
    const changes = decided.filter((r) => r.status === "approved");
    const inRange = requestFrom !== null && date >= requestFrom && date <= data.today;
    const pastMonth = date < `${data.today.slice(0, 7)}-01`;
    if (pending) summary.pending++;
    if (lastRejected) summary.rejected++;

    if (rec) {
      const approvedHoliday = !!rec.holiday_approved;
      const counted = !rec.holiday || approvedHoliday;
      if (counted) summary.worked++;
      if (approvedHoliday) summary.holidayWorked++;
      if (rec.holiday && !approvedHoliday) summary.holidayWaiting++;
      if (rec.out_method === "auto") summary.auto++;
      if (rec.out_at && counted) summary.minutes += Math.max(0, Math.floor((new Date(rec.out_at).getTime() - new Date(rec.in_at).getTime()) / 60_000));
      const kind: RowKind = !rec.out_at ? (date === data.today ? "open" : "noout") : rec.out_method === "auto" ? "auto" : rec.holiday ? "holiday" : "plain";
      // 우선순위: 승인 대기 > 퇴근 전 > 최근 반려 > 상신 전 휴일 > 정정됨 > 휴일 근무 인정 > 기본
      const lastApproved = changes[changes.length - 1];
      let badge: RowBadge = kind;
      if (pending) badge = pending.kind === "holiday" ? "holidayPending" : "pending";
      else if (kind === "open") badge = "open";
      else if (lastRejected) badge = lastRejected.kind === "holiday" ? "holidayRejected" : "rejected";
      else if (rec.holiday && !approvedHoliday) badge = "holiday";
      else if (lastApproved?.kind === "correction") badge = "corrected";
      else if (approvedHoliday) badge = "holidayApproved";
      const holidayOpen = rec.holiday && !approvedHoliday;
      rows.push({
        date,
        label,
        dayTone,
        holidayName,
        kind,
        badge,
        inTime: kstTime(rec.in_at),
        outTime: rec.out_at ? kstTime(rec.out_at) : null,
        stay: rec.out_at ? stayLabel(rec.in_at, rec.out_at) : date === data.today ? `지금 ${stayLabel(rec.in_at, now.toISOString())}째` : null,
        record: rec,
        pending,
        lastRejected,
        changes,
        // 승인 전 휴일은 상신으로(시각도 함께 고칠 수 있음), 그 밖에는 정정
        canCorrect: inRange && !pending && !holidayOpen,
        canHoliday: inRange && !pending && holidayOpen && !!rec.out_at,
        pastMonth,
      });
    } else if (workday && date >= data.since) {
      if (date !== data.today) summary.missing++;
      const kind: RowKind = date === data.today ? "before" : "none";
      rows.push({
        date,
        label,
        dayTone,
        holidayName,
        kind,
        badge: pending ? "pending" : lastRejected ? "rejected" : kind,
        inTime: null,
        outTime: null,
        stay: null,
        record: null,
        pending,
        lastRejected,
        changes,
        canCorrect: inRange && !pending,
        canHoliday: false,
        pastMonth,
      });
    }
  }
  return { rows, summary };
}

export function minutesLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}
