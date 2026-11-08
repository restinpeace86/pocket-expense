// 직원별 연차 — 근로기준법 제60조 법 기준 추천값 계산(spec/features/attendance.md §7, D-240). 순수 함수
// 추천값은 참고값이고 최종 일수는 회사가 확정한다. 출근율 80%·개근 판단은 하지 않는다(출퇴근 기록은 참고 자료로만)
export type LeaveSettings = {
  basis: "calendar" | "hire";
  under_five: boolean;
  hourly_leave: boolean;
  rounding: "day" | "half" | "hour";
  daily_hours: number;
  work_days: number[];
};
export type LeaveMember = { id: string; name: string; role: "employee" | "admin" | "super_admin"; hire_date: string | null };
export type LeaveGrant = {
  member_id: string;
  period_start: string;
  period_end: string;
  recommended: number | null;
  granted: number;
  reason: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string;
};
export type LeaveAdminData = {
  year: number;
  today: string;
  enabled: boolean;
  enabled_since: string | null;
  settings: LeaveSettings;
  members: LeaveMember[];
  grants: LeaveGrant[];
  days: { member_id: string; work_date: string }[];
  holidays: string[];
};

export type CalcStep = { text: string; law?: string };
export type MonthCheck = { n: number; from: string; to: string; accrual: string; accrued: boolean; workdays: number; recorded: number; missing: string[]; state: "ok" | "check" | "noapp" | "future" };
export type Recommendation = {
  periodStart: string;
  periodEnd: string;
  days: number | null;
  why: "ok" | "no_hire" | "owner" | "under_five" | "not_yet";
  steps: CalcStep[];
  service: string; // 근속 "7년" / "7개월" / "—"
  nextAccrual: string | null; // 1년 미만: 다음 1일이 생기는 날
  months: MonthCheck[]; // 1년 미만 월차 개근 참고
};
export type LeaveStatus = "unconfirmed" | "direct" | "confirmed" | "above" | "below" | "grown" | "no_hire";

export const ROUNDING_LABEL: Record<LeaveSettings["rounding"], string> = { day: "1일 단위 올림", half: "0.5일 단위 올림", hour: "시간 단위 올림" };

// ── 날짜 ──
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function addMonths(date: string, n: number): string {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const ty = t.getUTCFullYear();
  const tm = t.getUTCMonth() + 1;
  return ymd(ty, tm, Math.min(d, lastDay(ty, tm)));
}
export const addYears = (date: string, n: number) => addMonths(date, n * 12);
export function addDays(date: string, n: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
const isoDow = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export function serviceLabel(hire: string, asOf: string): string {
  if (hire > asOf) return "입사 전";
  let months = 0;
  while (addMonths(hire, months + 1) <= asOf) months++;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return `${m}개월`;
  return m ? `${y}년 ${m}개월` : `${y}년`;
}

// ── 일수 ──
const EPS = 1e-9;
export function roundProrated(raw: number, rounding: LeaveSettings["rounding"], dailyHours: number): number {
  if (rounding === "half") return Math.ceil(raw * 2 - EPS) / 2;
  if (rounding === "hour") return Math.ceil(raw * dailyHours - EPS) / dailyHours;
  return Math.ceil(raw - EPS);
}
// 15 → "15일", 1.5 → "1.5일", 1.875(8시간) → "1일 7시간"
export function daysLabel(days: number, dailyHours: number): string {
  if (Number.isInteger(Math.round(days * 1000) / 1000 * 2)) return `${Math.round(days * 10) / 10}일`;
  const whole = Math.floor(days + EPS);
  const hours = Math.round((days - whole) * dailyHours);
  if (!whole) return `${hours}시간`;
  return hours ? `${whole}일 ${hours}시간` : `${whole}일`;
}
// 근속 N년(1년 이상) → 15 + (N-1)÷2, 최대 25 (제60조 ①④)
export function annualDays(years: number): number {
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
}
function annualSteps(years: number, asOfLabel: string): CalcStep[] {
  const extra = Math.floor((years - 1) / 2);
  const steps: CalcStep[] = [{ text: `${asOfLabel} 근속 ${years}년 → 1년 이상 근무 기본 15일`, law: "제60조 ①" }];
  if (years >= 3) steps.push({ text: `3년 이상 → 첫 1년 뒤 2년마다 1일: (${years} − 1) ÷ 2 = ${extra}일${15 + extra > 25 ? " → 최대 25일" : ""}`, law: "제60조 ④" });
  return steps;
}

// 1년 미만 월차: 입사 후 m개월(1~11)을 마친 날(입사일 + m개월)에 1일 — [from, to] 사이, asOf까지
function accruals(hire: string, from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 11; m++) {
    const d = addMonths(hire, m);
    if (d >= from && d <= to) out.push(d);
  }
  return out;
}

function monthChecks(hire: string, inPeriod: string[], today: string, data: Pick<LeaveAdminData, "enabled_since" | "settings" | "holidays">, recorded: Set<string>): MonthCheck[] {
  const holidays = new Set(data.holidays);
  return inPeriod.map((accrual) => {
    const n = (() => {
      for (let m = 1; m <= 11; m++) if (addMonths(hire, m) === accrual) return m;
      return 0;
    })();
    const from = addMonths(hire, n - 1);
    const to = addDays(accrual, -1);
    if (accrual > today) return { n, from, to, accrual, accrued: false, workdays: 0, recorded: 0, missing: [], state: "future" as const };
    const since = data.enabled_since;
    if (!since || to < since) return { n, from, to, accrual, accrued: true, workdays: 0, recorded: 0, missing: [], state: "noapp" as const };
    let workdays = 0;
    let rec = 0;
    const missing: string[] = [];
    for (let d = from > since ? from : since; d <= to; d = addDays(d, 1)) {
      if (!data.settings.work_days.includes(isoDow(d)) || holidays.has(d)) continue;
      workdays++;
      if (recorded.has(d)) rec++;
      else missing.push(d);
    }
    return { n, from, to, accrual, accrued: true, workdays, recorded: rec, missing, state: missing.length ? ("check" as const) : ("ok" as const) };
  });
}

export function recommend(member: LeaveMember, data: LeaveAdminData): Recommendation {
  const { year, today, settings } = data;
  const empty = (why: Recommendation["why"], periodStart: string, periodEnd: string, service = "—"): Recommendation => ({ periodStart, periodEnd, days: null, why, steps: [], service, nextAccrual: null, months: [] });
  const calStart = ymd(year, 1, 1);
  const calEnd = ymd(year, 12, 31);
  const hire = member.hire_date;
  if (!hire) return empty("no_hire", calStart, calEnd);
  const service = serviceLabel(hire, today);
  const hy = parts(hire)[0];

  // 연차 연도(기간)
  let periodStart = calStart;
  let periodEnd = calEnd;
  if (settings.basis === "hire") {
    const n = year - hy;
    periodStart = n <= 0 ? hire : addYears(hire, n);
    periodEnd = addDays(addYears(hire, Math.max(n, 0) + 1), -1);
  }
  if (member.role === "super_admin") return empty("owner", periodStart, periodEnd, service);
  if (settings.under_five) return empty("under_five", periodStart, periodEnd, service);
  if (hire > periodEnd || year < hy) return empty("not_yet", periodStart, periodEnd, service);

  const recorded = new Set(data.days.filter((d) => d.member_id === member.id).map((d) => d.work_date));
  const asOf = today < periodEnd ? today : periodEnd;
  const steps: CalcStep[] = [];
  let days = 0;
  let months: MonthCheck[] = [];
  let nextAccrual: string | null = null;

  const monthly = (from: string, to: string) => {
    const all = accruals(hire, from, to);
    months = monthChecks(hire, all, today, data, recorded);
    const got = all.filter((d) => d <= asOf);
    nextAccrual = all.find((d) => d > today) ?? null;
    return got.length;
  };

  if (settings.basis === "calendar") {
    if (hy === year) {
      const got = monthly(hire, periodEnd);
      days = got;
      steps.push({ text: `입사 첫해: 1개월 개근할 때마다 1일 → 지금까지 ${got}일${nextAccrual ? ` (다음 1일 ${md(nextAccrual)})` : ""}`, law: "제60조 ②" });
      steps.push({ text: `내년 1월 1일에 올해 근무한 날만큼 비례 연차(15일 × 재직일수 ÷ 365)가 생겨요` });
    } else if (hy === year - 1) {
      const worked = daysInclusive(hire, ymd(year - 1, 12, 31));
      const raw = (15 * worked) / 365;
      const rounded = roundProrated(raw, settings.rounding, settings.daily_hours);
      const got = monthly(periodStart, periodEnd);
      days = rounded + got;
      steps.push({ text: `1월 1일 비례 연차: ${year - 1}년 근무 ${worked}일 → 15 × ${worked} ÷ 365 = ${Math.floor(raw * 100) / 100}일 → ${ROUNDING_LABEL[settings.rounding]} ${daysLabel(rounded, settings.daily_hours)}`, law: "회계연도 기준(행정해석)" });
      steps.push({ text: `입사 1년 안 월차 중 올해 생기는 것: 지금까지 ${got}일${nextAccrual ? ` (다음 1일 ${md(nextAccrual)})` : ""} (최대 11일)`, law: "제60조 ②" });
    } else {
      const years = year - hy;
      days = annualDays(years);
      steps.push(...annualSteps(years, `${year}년 1월 1일 기준`));
    }
  } else {
    const n = year - hy;
    if (n <= 0) {
      const got = monthly(hire, periodEnd);
      days = got;
      steps.push({ text: `입사 1년 안: 1개월 개근할 때마다 1일 → 지금까지 ${got}일${nextAccrual ? ` (다음 1일 ${md(nextAccrual)})` : ""} (최대 11일)`, law: "제60조 ②" });
      steps.push({ text: `${addYears(hire, 1)}(1년 근무를 마친 다음 날)에 15일이 생겨요`, law: "제60조 ①" });
    } else {
      days = annualDays(n);
      steps.push(...annualSteps(n, `${periodStart}(입사 ${n}년 되는 날) 기준`));
      if (periodStart > today) steps.push({ text: `${periodStart}에 생겨요(근무를 마친 다음 날)`, law: "2021 대법원·노동부 해석" });
    }
  }
  return { periodStart, periodEnd, days, why: "ok", steps, service, nextAccrual, months };
}

export function leaveStatus(rec: Recommendation, grant: LeaveGrant | undefined): LeaveStatus {
  if (rec.why === "no_hire" && !grant) return "no_hire";
  if (!grant) return rec.days === null ? "direct" : "unconfirmed";
  if (rec.days === null) return "confirmed";
  const g = grant.granted;
  if (grant.recommended !== null && rec.days > grant.recommended + EPS && g < rec.days - EPS) return "grown";
  if (g < rec.days - EPS) return "below";
  if (g > rec.days + EPS) return "above";
  return "confirmed";
}

export function buildLeaveRows(data: LeaveAdminData) {
  return data.members.map((m) => {
    const rec = recommend(m, data);
    const grant = data.grants.find((g) => g.member_id === m.id && g.period_start === rec.periodStart);
    return { member: m, rec, grant: grant ?? null, status: leaveStatus(rec, grant) };
  });
}
export type LeaveRow = ReturnType<typeof buildLeaveRows>[number];
