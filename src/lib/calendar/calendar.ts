// 사내 캘린더 화면 계산 (D-206, spec/features/calendar.md). 순수 함수라 단위 테스트한다.
// 날짜는 모두 한국 날짜 "YYYY-MM-DD". 주는 월요일 시작(local-open-spaces 파트너 달력과 같음).
import { claimCutoff, taxCloseDue } from "@/lib/expense/deadline";

export type CalKind = "meeting" | "outside" | "trip" | "other";
export type CalResponse = "pending" | "accepted" | "declined";
export type CalAttendee = { member_id: string; name: string; status: string; response: CalResponse };
export type CalEvent = {
  id: string;
  title: string;
  kind: CalKind;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  memo: string | null;
  room_id?: string | null; // 회의실(D-207)
  room_name?: string | null;
  created_by: string;
  creator_name: string | null;
  mine: boolean;
  attendees: CalAttendee[];
};
export type MeetingRoom = { id: string; name: string; upcoming: number };
export type CalMember = { member_id: string; name: string; position: string | null; department_id: string | null };
export type CalDirectory = {
  me: string;
  departments: { id: string; name: string }[];
  members: CalMember[];
  prefs: { member_ids: string[]; show_deadlines: boolean } | null;
};
export type Holiday = { day: string; name: string };
export type Deadline = { date: string; kind: "claim" | "tax"; label: string; sub: string };

export const KIND_LABEL: Record<CalKind, string> = { meeting: "회의", outside: "외근", trip: "출장", other: "기타" };
export const WEEKDAY_HEADERS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAY_SUN0 = ["일", "월", "화", "수", "목", "금", "토"];

const KST = 9 * 3600_000;
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return ymd(x);
};
export const kstDateOf = (iso: string) => new Date(Date.parse(iso) + KST).toISOString().slice(0, 10);
export const kstTimeOf = (iso: string) => new Date(Date.parse(iso) + KST).toISOString().slice(11, 16);
export const todayKst = (now: number = Date.now()) => new Date(now + KST).toISOString().slice(0, 10);

export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const monthTitle = (ym: string) => `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5, 7))}월`;

// 월 달력 칸: 그 달 1일이 있는 주 월요일 ~ 말일이 있는 주 일요일(7의 배수)
export function monthCells(ym: string): { date: string; inMonth: boolean }[] {
  const first = `${ym}-01`;
  const last = addDays(`${shiftMonth(ym, 1)}-01`, -1);
  const lead = (utc(first).getUTCDay() + 6) % 7; // 월=0 … 일=6
  const trail = 6 - ((utc(last).getUTCDay() + 6) % 7);
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let d = addDays(first, -lead); d <= addDays(last, trail); d = addDays(d, 1)) cells.push({ date: d, inMonth: d.slice(0, 7) === ym });
  return cells;
}

// 휴대폰 날짜별 목록: 그 달 1일 ~ 말일
export function monthDays(ym: string): string[] {
  const out: string[] = [];
  for (let d = `${ym}-01`; d.slice(0, 7) === ym; d = addDays(d, 1)) out.push(d);
  return out;
}

// 일=0 … 토=6
export const weekdayOf = (d: string) => utc(d).getUTCDay();
export const weekdayLabel = (d: string) => WEEKDAY_SUN0[weekdayOf(d)];
export const dayLabel = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 (${weekdayLabel(d)})`;
export const shortDayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${weekdayLabel(d)})`;

// 날짜 색: 일요일·공휴일 = 빨강, 토요일 = 파랑(D-206). 공휴일이 토요일이면 빨강
export function dayTone(d: string, holidays: Map<string, string>): "holiday" | "sun" | "sat" | null {
  if (holidays.has(d)) return "holiday";
  const w = weekdayOf(d);
  return w === 0 ? "sun" : w === 6 ? "sat" : null;
}
export const holidayMap = (list: Holiday[]) => new Map(list.map((h) => [h.day, h.name]));

// 마감일(D-161 고정 규칙, 쉬는 날이면 앞 영업일): 청구 마감 = 다음 달 2일(모두), 세무 마감 = 다음 달 5일(관리자만)
export function deadlinesBetween(from: string, to: string, holidayDays: string[], admin: boolean): Deadline[] {
  const out: Deadline[] = [];
  // 앞 영업일로 당겨져 앞 달 말로 넘어오는 경우까지 보려고 한 달 앞뒤로 넉넉히
  for (let used = shiftMonth(from.slice(0, 7), -2); used <= to.slice(0, 7); used = shiftMonth(used, 1)) {
    const m = Number(used.slice(5, 7));
    const c = claimCutoff(used, holidayDays);
    if (c >= from && c <= to) out.push({ date: c, kind: "claim", label: "청구 마감", sub: `${m}월 사용분` });
    if (admin) {
      const t = taxCloseDue(used, holidayDays);
      if (t >= from && t <= to) out.push({ date: t, kind: "tax", label: "세무 마감", sub: `${m}월분` });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

// 그 날(한국 날짜)에 걸친 일정인가
export function onDay(e: Pick<CalEvent, "all_day" | "starts_at" | "ends_at" | "start_date" | "end_date">, d: string): boolean {
  if (e.all_day) return !!e.start_date && !!e.end_date && e.start_date <= d && e.end_date >= d;
  if (!e.starts_at || !e.ends_at) return false;
  const start = Date.parse(`${d}T00:00:00+09:00`);
  const end = start + 86400_000;
  return Date.parse(e.starts_at) < end && Date.parse(e.ends_at) > start;
}

// 하루 목록 순서: 종일 먼저, 그다음 시작 시각
export function eventsOnDay(events: CalEvent[], d: string): CalEvent[] {
  return events
    .filter((e) => onDay(e, d))
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || (a.starts_at ?? a.start_date ?? "").localeCompare(b.starts_at ?? b.start_date ?? "") || a.title.localeCompare(b.title));
}

// "14:00~15:00" / 여러 날이면 그날 기준("~15:00", "14:00~", "종일") / 종일 일정 "종일"
export function timeLabelOn(e: CalEvent, d: string): string {
  if (e.all_day || !e.starts_at || !e.ends_at) return "종일";
  const sd = kstDateOf(e.starts_at);
  const ed = kstDateOf(new Date(Date.parse(e.ends_at) - 1).toISOString());
  const s = sd === d ? kstTimeOf(e.starts_at) : "";
  const t = ed === d ? kstTimeOf(e.ends_at) : "";
  if (!s && !t) return "종일";
  return `${s}~${t}`;
}

// 상세의 시간 한 줄
export function fullTimeLabel(e: CalEvent): string {
  if (e.all_day && e.start_date && e.end_date) return e.start_date === e.end_date ? `${dayLabel(e.start_date)} 종일` : `${dayLabel(e.start_date)} ~ ${dayLabel(e.end_date)} 종일`;
  if (!e.starts_at || !e.ends_at) return "";
  const sd = kstDateOf(e.starts_at);
  const ed = kstDateOf(e.ends_at);
  return sd === ed ? `${dayLabel(sd)} ${kstTimeOf(e.starts_at)}~${kstTimeOf(e.ends_at)}` : `${dayLabel(sd)} ${kstTimeOf(e.starts_at)} ~ ${dayLabel(ed)} ${kstTimeOf(e.ends_at)}`;
}

// 10분 단위 시각(00:00 … 23:50) — 회의 10분 전 알림이 10분마다 도는 작업과 맞도록(D-206)
export const TIME_OPTIONS: string[] = Array.from({ length: 144 }, (_, i) => `${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}`);
export const isTenMinute = (hhmm: string) => /^([01]\d|2[0-3]):[0-5]0$/.test(hhmm);
// 한국 날짜 + 시각 → ISO(UTC)
export const kstIso = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+09:00`).toISOString();
// 다음 정시(새 일정 기본 시작)
export function nextHour(now: number = Date.now()): { date: string; time: string } {
  const k = new Date(now + KST);
  k.setUTCMinutes(0, 0, 0);
  k.setUTCHours(k.getUTCHours() + 1);
  const iso = k.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
export function addMinutes(d: string, hhmm: string, minutes: number): { date: string; time: string } {
  const iso = new Date(Date.parse(`${d}T${hhmm}:00+09:00`) + minutes * 60_000 + KST).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// 사람 색(그 사람에게 늘 같은 색 — 고른 순서와 상관없음). 나는 브랜드 색
export const PERSON_COLORS = [
  { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-900 border-sky-300" },
  { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-900 border-violet-300" },
  { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-900 border-amber-300" },
  { dot: "bg-pink-500", chip: "bg-pink-100 text-pink-900 border-pink-300" },
  { dot: "bg-teal-500", chip: "bg-teal-100 text-teal-900 border-teal-300" },
  { dot: "bg-lime-600", chip: "bg-lime-100 text-lime-900 border-lime-300" },
  { dot: "bg-slate-500", chip: "bg-slate-200 text-slate-900 border-slate-300" },
];
const ME_COLOR = { dot: "bg-brand-600", chip: "bg-brand-100 text-brand-900 border-brand-300" };
export function personColor(id: string, me: string) {
  if (id === me) return ME_COLOR;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}
// 일정 색 = 그 일정이 보이는 (고른) 사람의 색. 여러 명이면 만든 사람, 만든 사람이 안 골라졌으면 고른 사람 중 첫 참석자
export function eventOwnerFor(e: CalEvent, selected: string[]): string {
  if (selected.includes(e.created_by)) return e.created_by;
  return e.attendees.find((a) => selected.includes(a.member_id))?.member_id ?? e.created_by;
}

// 참석자 한 줄 "김A, 이B 외 1"
export function attendeeSummary(e: CalEvent, max = 2): string {
  const names = e.attendees.map((a) => (a.status === "inactive" ? `${a.name}(퇴사)` : a.name));
  return names.length > max ? `${names.slice(0, max).join(", ")} 외 ${names.length - max}` : names.join(", ");
}

export const SAVE_ERRORS: Record<string, string> = {
  TITLE_REQUIRED: "제목을 적어 주세요.",
  TITLE_TOO_LONG: "제목은 100자까지예요.",
  INVALID_TIME: "끝나는 시간이 시작보다 늦어야 해요(시간 일정은 14일, 종일은 31일까지).",
  TIME_UNIT_10MIN: "시간은 10분 단위로 골라 주세요.",
  LOCATION_TOO_LONG: "장소는 200자까지예요.",
  MEMO_TOO_LONG: "메모는 2,000자까지예요.",
  NOT_OWNER: "만든 사람만 고칠 수 있어요.",
  NOT_FOUND: "지워졌거나 볼 수 없는 일정이에요.",
  FEATURE_DISABLED: "캘린더를 쓸 수 없는 회사예요.",
  ROOM_TAKEN: "그 시간에 이미 예약된 회의실이에요. 다른 시간이나 다른 회의실을 골라 주세요.",
  ROOM_ALL_DAY: "회의실은 시간 일정에만 잡을 수 있어요(종일 일정 불가).",
  ROOM_NOT_FOUND: "지워졌거나 없는 회의실이에요. 다시 골라 주세요.",
  ROOM_NAME_REQUIRED: "회의실 이름을 적어 주세요.",
  ROOM_NAME_TOO_LONG: "회의실 이름은 50자까지예요.",
  ROOM_NAME_TAKEN: "같은 이름의 회의실이 이미 있어요.",
  TOO_MANY_ROOMS: "회의실은 30개까지 등록할 수 있어요.",
  NOT_ALLOWED: "관리자만 할 수 있어요.",
  EVENT_KIND_NO_CLAIM: "출장·회의 일정에서만 경비를 올릴 수 있어요.",
  NOT_ATTENDEE: "이 일정의 참석자(불참 제외)만 경비를 올릴 수 있어요.",
  NOT_A_MEMBER: "다시 로그인해 주세요.",
};

// 일정에 묶인 경비(D-210, calendar_event_claims)
export type EventClaim = { id: string; title: string; status: "draft" | "submitted" | "approved" | "rejected" | "paid"; total_amount: number; member_name: string; mine: boolean };
export const CLAIM_KINDS: CalKind[] = ["trip", "meeting"];
export function saveErrorText(message: string | undefined): string {
  return (message && SAVE_ERRORS[message]) || "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}

// ── 회의실(D-207) ─────────────────────────────────────────────────────────────
// 장소 표시: 회의실 이름 + 적은 장소("3층 회의실 · 빔 프로젝터")
export function placeLabel(e: Pick<CalEvent, "room_name" | "location">): string | null {
  return [e.room_name, e.location].filter((v): v is string => !!v && !!v.trim()).join(" · ") || null;
}

// 고른 시간에 그 회의실을 이미 잡은 일정(지금 고치는 일정은 빼고). 끝 = 다음 시작은 겹침 아님
export function roomConflict(bookings: CalEvent[], roomId: string, startsIso: string, endsIso: string, excludeId?: string | null): CalEvent | null {
  const s = Date.parse(startsIso);
  const e = Date.parse(endsIso);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return (
    bookings.find(
      (b) => b.room_id === roomId && b.id !== excludeId && !!b.starts_at && !!b.ends_at && Date.parse(b.starts_at) < e && Date.parse(b.ends_at) > s,
    ) ?? null
  );
}

