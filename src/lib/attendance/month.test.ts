import { describe, expect, it } from "vitest";
import { buildMonth, minutesLabel, monthEndNotice, shiftMonth, type AttendanceRequest, type MonthData } from "./month";

// 2026-11-15 = 일요일, 11-14 = 토요일
const base: MonthData = {
  month: "2026-11",
  today: "2026-11-20",
  since: "2026-11-10",
  work_days: [1, 2, 3, 4, 5],
  holidays: [],
  days: [
    { work_date: "2026-11-20", in_at: "2026-11-20T08:52:00+09:00", out_at: null, out_method: null, holiday: false, sched_end: "18:00", in_terminal: "1층", out_terminal: null },
    { work_date: "2026-11-19", in_at: "2026-11-19T08:57:00+09:00", out_at: "2026-11-19T18:12:00+09:00", out_method: "qr", holiday: false, sched_end: "18:00", in_terminal: "1층", out_terminal: "1층" },
    { work_date: "2026-11-18", in_at: "2026-11-18T09:03:00+09:00", out_at: "2026-11-18T18:00:00+09:00", out_method: "auto", holiday: false, sched_end: "18:00", in_terminal: "1층", out_terminal: null },
    { work_date: "2026-11-15", in_at: "2026-11-15T10:02:00+09:00", out_at: "2026-11-15T15:40:00+09:00", out_method: "qr", holiday: true, sched_end: "18:00", in_terminal: "1층", out_terminal: "1층" },
  ],
};

describe("월 근태 현황", () => {
  const { rows, summary } = buildMonth(base, new Date("2026-11-20T18:00:00+09:00"));
  it("최근 날짜가 위, 오늘까지만", () => {
    expect(rows[0].date).toBe("2026-11-20");
    expect(rows.every((r) => r.date <= "2026-11-20")).toBe(true);
  });
  it("표시: 퇴근 전·자동 퇴근·휴일·기록 없음", () => {
    const k = Object.fromEntries(rows.map((r) => [r.date, r.kind]));
    expect(k["2026-11-20"]).toBe("open");
    expect(k["2026-11-18"]).toBe("auto");
    expect(k["2026-11-15"]).toBe("holiday");
    expect(k["2026-11-17"]).toBe("none");
  });
  it("기록 없는 휴일은 빼고, '기록 없음'은 since부터", () => {
    expect(rows.find((r) => r.date === "2026-11-14")).toBeUndefined(); // 토요일(기록 없음)
    expect(rows.find((r) => r.date === "2026-11-09")).toBeUndefined(); // since 전
    expect(rows.find((r) => r.date === "2026-11-10")?.kind).toBe("none");
  });
  it("요약 — 승인 전 휴일 출근은 세지 않음(D-239)", () => {
    expect(summary).toEqual({ worked: 3, holidayWorked: 0, holidayWaiting: 1, minutes: 555 + 537, auto: 1, missing: 6, pending: 0, rejected: 0, leaveDays: 0 });
    expect(rows[0].stay).toBe("지금 9시간 8분째");
  });
  it("공휴일은 근무일이 아님 + 빨간 날", () => {
    const r = buildMonth({ ...base, holidays: [{ day: "2026-11-17", name: "테스트휴일" }] });
    expect(r.rows.find((x) => x.date === "2026-11-17")).toBeUndefined();
    expect(r.summary.missing).toBe(5);
  });
  it("오늘 기록 없으면 출근 전(누락으로 세지 않음)", () => {
    const r = buildMonth({ ...base, days: base.days.slice(1) });
    expect(r.rows[0]).toMatchObject({ date: "2026-11-20", kind: "before" });
    expect(r.summary.missing).toBe(6);
  });
  it("지난달은 말일부터", () => {
    const r = buildMonth({ ...base, month: "2026-10", since: "2026-10-01", days: [] });
    expect(r.rows[0].date).toBe("2026-10-30"); // 10/31 토
  });
  it("휴일 근무 인정되면 출근한 날·머문 시간에 셈", () => {
    const days = base.days.map((d) => (d.work_date === "2026-11-15" ? { ...d, holiday_approved: true } : d));
    const r = buildMonth({ ...base, days });
    expect(r.summary).toMatchObject({ worked: 4, holidayWorked: 1, holidayWaiting: 0, minutes: 555 + 537 + 338 });
    expect(r.rows.find((x) => x.date === "2026-11-15")?.badge).toBe("holidayApproved");
  });
  it("신청 상태 표시와 신청 가능 여부(이번 달만, 대기 1건)", () => {
    const req = (o: Partial<AttendanceRequest>): AttendanceRequest => ({
      id: Math.random().toString(), work_date: "2026-11-18", kind: "correction", new_in: "09:03", new_out: "20:30", reason: "더 일함", before: {},
      status: "pending", self_approved: false, decided_by_name: null, decided_at: null, reject_reason: null, created_at: "2026-11-19T00:00:00Z", ...o,
    });
    const r = buildMonth({
      ...base,
      request_from: "2026-11-10",
      requests: [
        req({}),
        req({ work_date: "2026-11-17", status: "rejected", reject_reason: "연차로", created_at: "2026-11-18T00:00:00Z" }),
        req({ work_date: "2026-11-19", status: "approved", created_at: "2026-11-19T01:00:00Z" }),
        req({ work_date: "2026-11-15", kind: "holiday", created_at: "2026-11-16T00:00:00Z" }),
      ],
    });
    const row = (d: string) => r.rows.find((x) => x.date === d)!;
    expect(row("2026-11-18")).toMatchObject({ badge: "pending", canCorrect: false });
    expect(row("2026-11-17")).toMatchObject({ badge: "rejected", canCorrect: true });
    expect(row("2026-11-17").lastRejected?.reject_reason).toBe("연차로");
    expect(row("2026-11-19")).toMatchObject({ badge: "corrected", canCorrect: true });
    expect(row("2026-11-19").changes).toHaveLength(1);
    expect(row("2026-11-15")).toMatchObject({ badge: "holidayPending", canHoliday: false, canCorrect: false });
    expect(row("2026-11-10")).toMatchObject({ badge: "none", canCorrect: true });
    expect(r.summary).toMatchObject({ pending: 2, rejected: 1 });
  });
  it("승인 전 휴일은 상신만, 신청 시작일 전·지난 달은 불가", () => {
    const r = buildMonth({ ...base, request_from: "2026-11-16" });
    expect(r.rows.find((x) => x.date === "2026-11-15")).toMatchObject({ badge: "holiday", canHoliday: false, canCorrect: false });
    const r2 = buildMonth({ ...base, request_from: "2026-11-10" });
    expect(r2.rows.find((x) => x.date === "2026-11-15")).toMatchObject({ canHoliday: true, canCorrect: false });
    const old = buildMonth({ ...base, month: "2026-10", since: "2026-10-01", request_from: "2026-11-01", days: [] });
    expect(old.rows.every((x) => !x.canCorrect && x.pastMonth)).toBe(true);
  });
  it("승인된 종일 휴가는 '휴가'(기록 없음에서 빠짐), 시간 휴가는 그날 표시", () => {
    const r = buildMonth({
      ...base,
      leaves: [
        { id: "l1", type_name: "연차", unit: "day", start_date: "2026-11-16", end_date: "2026-11-17", start_time: null, hours: null },
        { id: "l2", type_name: "연차", unit: "hour", start_date: "2026-11-19", end_date: "2026-11-19", start_time: "14:00", hours: 4 },
      ],
    });
    expect(r.rows.find((x) => x.date === "2026-11-17")).toMatchObject({ kind: "leave", badge: "leave" });
    expect(r.rows.find((x) => x.date === "2026-11-17")?.leave?.text).toBe("휴가 · 연차");
    expect(r.rows.find((x) => x.date === "2026-11-19")?.leave?.text).toContain("14:00부터 4시간");
    expect(r.summary).toMatchObject({ missing: 4, leaveDays: 2 });
  });
  it("말일 안내: 마지막 3일", () => {
    expect(monthEndNotice("2026-11-27")).toBeNull();
    expect(monthEndNotice("2026-11-28")).toBe("11/30 (월)");
    expect(monthEndNotice("2026-02-26")).toBe("2/28 (토)");
  });
  it("도우미", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(minutesLabel(1430)).toBe("23시간 50분");
  });
});
