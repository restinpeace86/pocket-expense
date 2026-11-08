import { describe, expect, it } from "vitest";
import { buildMonth, minutesLabel, shiftMonth, type MonthData } from "./month";

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
  it("요약", () => {
    expect(summary).toEqual({ worked: 4, holidayWorked: 1, minutes: 555 + 537 + 338, auto: 1, missing: 6 });
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
  it("도우미", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(minutesLabel(1430)).toBe("23시간 50분");
  });
});
