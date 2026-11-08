import { kstTime, stayLabel } from "./rules";

// 월 근태 현황 계산(spec/features/attendance.md §5, D-237) — 순수 함수
export type MonthDay = {
  work_date: string;
  in_at: string;
  out_at: string | null;
  out_method: "qr" | "auto" | null;
  holiday: boolean;
  sched_end: string;
  in_terminal: string | null;
  out_terminal: string | null;
};
export type MonthData = { month: string; today: string; since: string; work_days: number[]; holidays: { day: string; name: string }[]; days: MonthDay[] };

export type RowKind = "plain" | "auto" | "holiday" | "open" | "noout" | "none" | "before";
export type MonthRow = {
  date: string;
  label: string; // "11/19 (수)"
  dayTone: "weekday" | "sat" | "red";
  holidayName: string | null;
  kind: RowKind;
  inTime: string | null;
  outTime: string | null;
  stay: string | null;
  record: MonthDay | null;
};
export type MonthSummary = { worked: number; holidayWorked: number; minutes: number; auto: number; missing: number };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const isoDow = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1=월 … 7=일

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function buildMonth(data: MonthData, now: Date = new Date()): { rows: MonthRow[]; summary: MonthSummary } {
  const start = `${data.month}-01`;
  const next = `${shiftMonth(data.month, 1)}-01`;
  const last = data.today < next ? data.today : addDays(next, -1);
  const byDate = new Map(data.days.map((d) => [d.work_date, d]));
  const holidays = new Map(data.holidays.map((h) => [h.day, h.name]));
  const rows: MonthRow[] = [];
  const summary: MonthSummary = { worked: 0, holidayWorked: 0, minutes: 0, auto: 0, missing: 0 };

  for (let date = last; date >= start; date = addDays(date, -1)) {
    const dow = isoDow(date);
    const holidayName = holidays.get(date) ?? null;
    const workday = data.work_days.includes(dow) && !holidayName;
    const rec = byDate.get(date) ?? null;
    const [, mm, dd] = date.split("-");
    const label = `${Number(mm)}/${Number(dd)} (${WEEK[dow % 7]})`;
    const dayTone = holidayName || dow === 7 ? "red" : dow === 6 ? "sat" : "weekday";
    if (rec) {
      summary.worked++;
      if (rec.holiday) summary.holidayWorked++;
      if (rec.out_method === "auto") summary.auto++;
      if (rec.out_at) summary.minutes += Math.max(0, Math.floor((new Date(rec.out_at).getTime() - new Date(rec.in_at).getTime()) / 60_000));
      const kind: RowKind = !rec.out_at ? (date === data.today ? "open" : "noout") : rec.out_method === "auto" ? "auto" : rec.holiday ? "holiday" : "plain";
      rows.push({
        date,
        label,
        dayTone,
        holidayName,
        kind,
        inTime: kstTime(rec.in_at),
        outTime: rec.out_at ? kstTime(rec.out_at) : null,
        stay: rec.out_at ? stayLabel(rec.in_at, rec.out_at) : date === data.today ? `지금 ${stayLabel(rec.in_at, now.toISOString())}째` : null,
        record: rec,
      });
    } else if (workday && date >= data.since) {
      if (date !== data.today) summary.missing++;
      rows.push({ date, label, dayTone, holidayName, kind: date === data.today ? "before" : "none", inTime: null, outTime: null, stay: null, record: null });
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
