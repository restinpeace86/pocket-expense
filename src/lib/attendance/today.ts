import { kstTime, stayLabel } from "./rules";

// 오늘 출근 현황(spec/features/attendance.md §9, D-242) — 순수 함수. 지각·조퇴는 판단하지 않는다(찍힌 시각만)
export type DayAdminData = {
  date: string;
  today: string;
  now: string;
  work_start: string;
  work_end: string;
  workday: boolean;
  holiday_name: string | null;
  enabled_since: string | null;
  members: { id: string; name: string; role: "employee" | "admin" | "super_admin"; department: string | null; since: string }[];
  days: { member_id: string; in_at: string; out_at: string | null; out_method: "qr" | "auto" | "correction" | null; holiday: boolean; holiday_approved: boolean; in_terminal: string | null; out_terminal: string | null }[];
  leaves: { member_id: string; type_name: string; unit: "day" | "hour"; start_time: string | null; hours: number | null }[];
};
export type DayStatus = "working" | "out" | "before" | "none" | "leave" | "off" | "not_yet";
export type DayRow = {
  id: string;
  name: string;
  department: string | null;
  role: DayAdminData["members"][number]["role"];
  status: DayStatus;
  label: string;
  inTime: string | null;
  outTime: string | null;
  terminal: string | null;
  memo: string;
};
export type DaySummary = { total: number; working: number; out: number; before: number; leave: number };

export const STATUS_LABEL: Record<DayStatus, string> = {
  working: "근무 중",
  out: "퇴근",
  before: "출근 전",
  none: "기록 없음",
  leave: "휴가",
  off: "쉬는 날",
  not_yet: "—",
};

export function buildDay(d: DayAdminData): { rows: DayRow[]; summary: DaySummary } {
  const isToday = d.date === d.today;
  const future = d.date > d.today;
  const rows: DayRow[] = d.members.map((m) => {
    const rec = d.days.find((x) => x.member_id === m.id) ?? null;
    const leave = d.leaves.find((x) => x.member_id === m.id) ?? null;
    const hourLeave = leave?.unit === "hour" ? `${leave.start_time}부터 ${leave.hours}시간 휴가(${leave.type_name})` : null;
    const base = { id: m.id, name: m.name, department: m.department, role: m.role, inTime: null, outTime: null, terminal: null };
    if (rec) {
      const inTime = kstTime(rec.in_at);
      const outTime = rec.out_at ? kstTime(rec.out_at) : null;
      const notes: string[] = [];
      if (rec.out_at) notes.push(stayLabel(rec.in_at, rec.out_at));
      else if (isToday) notes.push(`${stayLabel(rec.in_at, d.now)}째`);
      if (rec.out_method === "auto") notes.push("자정까지 안 찍어 정규 퇴근으로 자동 기록");
      if (rec.out_method === "correction") notes.push("정정됨");
      if (rec.holiday) notes.push(rec.holiday_approved ? "휴일 근무 인정" : "휴일 출근");
      if (hourLeave) notes.push(hourLeave);
      const status: DayStatus = rec.out_at ? "out" : isToday ? "working" : "none";
      const label = status === "out" ? (rec.out_method === "auto" ? "자동 퇴근" : "퇴근") : status === "working" ? (hourLeave ? "근무 중 · 시간 휴가" : "근무 중") : "퇴근 없음";
      return { ...base, status, label: rec.holiday && status !== "none" ? `휴일 · ${label}` : label, inTime, outTime, terminal: rec.out_terminal ?? rec.in_terminal, memo: notes.join(" · ") };
    }
    if (leave?.unit === "day") return { ...base, status: "leave", label: "휴가", memo: `${leave.type_name}(종일)` };
    if (!d.workday) return { ...base, status: "off", label: d.holiday_name ? `공휴일` : "쉬는 날", memo: d.holiday_name ?? "근무 요일이 아니에요" };
    if (d.date < m.since) return { ...base, status: "not_yet", label: "—", memo: "근태를 켜기 전이거나 가입 전이에요" };
    if (future) return { ...base, status: "not_yet", label: "—", memo: hourLeave ?? "앞날이에요" };
    if (isToday) return { ...base, status: "before", label: "출근 전", memo: hourLeave ?? "아직 출근 기록 없음" };
    return { ...base, status: "none", label: "기록 없음", memo: hourLeave ?? "출퇴근 기록이 없어요" };
  });
  const count = (s: DayStatus) => rows.filter((r) => r.status === s).length;
  return { rows, summary: { total: rows.length, working: count("working"), out: count("out"), before: count("before") + count("none"), leave: count("leave") } };
}

export type DayFilter = "all" | "working" | "out" | "before" | "leave";
export function filterRows(rows: DayRow[], f: DayFilter): DayRow[] {
  if (f === "all") return rows;
  if (f === "before") return rows.filter((r) => r.status === "before" || r.status === "none");
  return rows.filter((r) => r.status === f);
}
