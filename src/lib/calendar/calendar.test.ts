import { describe, expect, it } from "vitest";
import {
  addMinutes,
  dayTone,
  deadlinesBetween,
  eventOwnerFor,
  eventsOnDay,
  holidayMap,
  isTenMinute,
  kstIso,
  monthCells,
  monthDays,
  nextHour,
  placeLabel,
  roomConflict,
  TIME_OPTIONS,
  timeLabelOn,
  type CalEvent,
} from "./calendar";

const ev = (p: Partial<CalEvent>): CalEvent => ({
  id: "e",
  title: "회의",
  kind: "meeting",
  all_day: false,
  starts_at: null,
  ends_at: null,
  start_date: null,
  end_date: null,
  location: null,
  memo: null,
  created_by: "a",
  creator_name: "A",
  mine: false,
  attendees: [],
  ...p,
});

describe("월 달력 칸(월요일 시작)", () => {
  it("2026년 11월: 10/26(월) ~ 12/6(일), 6주", () => {
    const c = monthCells("2026-11");
    expect(c[0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(c.at(-1)).toEqual({ date: "2026-12-06", inMonth: false });
    expect(c.length % 7).toBe(0);
    expect(c.length).toBe(42);
  });
  it("2027년 2월(월요일 1일, 일요일 28일): 딱 4주", () => {
    const c = monthCells("2027-02");
    expect(c[0].date).toBe("2027-02-01");
    expect(c.length).toBe(28);
  });
  it("날짜별 목록은 그 달 날짜만", () => {
    expect(monthDays("2026-11")).toHaveLength(30);
    expect(monthDays("2028-02")).toHaveLength(29);
  });
});

describe("주말·공휴일 색", () => {
  const h = holidayMap([{ day: "2026-09-25", name: "추석" }, { day: "2026-10-03", name: "개천절" }]);
  it("일요일 빨강, 토요일 파랑, 공휴일 빨강(토요일이어도)", () => {
    expect(dayTone("2026-11-08", h)).toBe("sun");
    expect(dayTone("2026-11-07", h)).toBe("sat");
    expect(dayTone("2026-09-25", h)).toBe("holiday");
    expect(dayTone("2026-10-03", h)).toBe("holiday"); // 토요일 개천절
    expect(dayTone("2026-11-04", h)).toBeNull();
  });
});

describe("마감일(D-161 — 2일·5일, 쉬는 날이면 앞 영업일)", () => {
  it("직원: 청구 마감만, 관리자: 세무 마감도", () => {
    expect(deadlinesBetween("2026-11-01", "2026-11-30", [], false)).toEqual([{ date: "2026-11-02", kind: "claim", label: "청구 마감", sub: "10월 사용분" }]);
    const admin = deadlinesBetween("2026-11-01", "2026-11-30", [], true);
    expect(admin.map((d) => [d.date, d.kind])).toEqual([
      ["2026-11-02", "claim"],
      ["2026-11-05", "tax"],
    ]);
  });
  it("2일이 쉬는 날이면 앞 영업일 — 앞 달 말로 넘어가도 보인다", () => {
    // 2027-05-02(일) → 5/1(토) → 4/30(금)
    const d = deadlinesBetween("2027-04-26", "2027-05-09", [], false);
    expect(d).toEqual([{ date: "2027-04-30", kind: "claim", label: "청구 마감", sub: "4월 사용분" }]);
  });
  it("공휴일도 쉬는 날", () => {
    // 2026-10-05(월)은 개천절 대체공휴일 → 세무 마감 10/2(금)
    const d = deadlinesBetween("2026-10-01", "2026-10-31", ["2026-10-05"], true);
    expect(d.find((x) => x.kind === "tax")?.date).toBe("2026-10-02");
  });
});

describe("하루 일정", () => {
  const a = ev({ id: "1", starts_at: kstIso("2026-11-04", "14:00"), ends_at: kstIso("2026-11-04", "15:00") });
  const b = ev({ id: "2", all_day: true, start_date: "2026-11-03", end_date: "2026-11-05", title: "출장", kind: "trip" });
  const c = ev({ id: "3", starts_at: kstIso("2026-11-04", "22:00"), ends_at: kstIso("2026-11-05", "01:00") });
  const d = ev({ id: "4", starts_at: kstIso("2026-11-05", "00:00"), ends_at: kstIso("2026-11-05", "01:00") });
  it("종일 먼저, 다음 시작 시각. 자정에 끝나는 일정은 다음 날에 안 걸림", () => {
    expect(eventsOnDay([a, b, c, d], "2026-11-04").map((e) => e.id)).toEqual(["2", "1", "3"]);
    expect(eventsOnDay([a, b, c, d], "2026-11-05").map((e) => e.id)).toEqual(["2", "3", "4"]);
    expect(eventsOnDay([a], "2026-11-05")).toEqual([]);
  });
  it("시간 표시: 그날 기준", () => {
    expect(timeLabelOn(a, "2026-11-04")).toBe("14:00~15:00");
    expect(timeLabelOn(b, "2026-11-04")).toBe("종일");
    expect(timeLabelOn(c, "2026-11-04")).toBe("22:00~");
    expect(timeLabelOn(c, "2026-11-05")).toBe("~01:00");
  });
});

describe("10분 단위 시각", () => {
  it("00:00 ~ 23:50, 144개", () => {
    expect(TIME_OPTIONS).toHaveLength(144);
    expect(TIME_OPTIONS[0]).toBe("00:00");
    expect(TIME_OPTIONS.at(-1)).toBe("23:50");
    expect(isTenMinute("10:19")).toBe(false);
    expect(isTenMinute("10:10")).toBe(true);
  });
  it("한국 시각 → UTC, 다음 정시, 분 더하기(날 넘김)", () => {
    expect(kstIso("2026-11-04", "09:00")).toBe("2026-11-04T00:00:00.000Z");
    expect(nextHour(Date.parse("2026-11-04T05:23:00Z"))).toEqual({ date: "2026-11-04", time: "15:00" });
    expect(addMinutes("2026-11-04", "23:30", 60)).toEqual({ date: "2026-11-05", time: "00:30" });
  });
});

describe("일정 색 주인", () => {
  const e = ev({ created_by: "a", attendees: [{ member_id: "a", name: "A", status: "approved", response: "accepted" }, { member_id: "b", name: "B", status: "approved", response: "pending" }] });
  it("만든 사람이 골라져 있으면 만든 사람, 아니면 고른 참석자", () => {
    expect(eventOwnerFor(e, ["a", "b"])).toBe("a");
    expect(eventOwnerFor(e, ["b"])).toBe("b");
  });
});

describe("회의실(D-207)", () => {
  const b = [
    ev({ id: "a", room_id: "r1", starts_at: "2030-01-07T01:00:00Z", ends_at: "2030-01-07T02:00:00Z" }),
    ev({ id: "b", room_id: "r2", starts_at: "2030-01-07T01:00:00Z", ends_at: "2030-01-07T02:00:00Z" }),
  ];
  it("같은 방·겹치는 시간만 충돌, 끝=다음 시작은 OK, 고치는 일정은 제외", () => {
    expect(roomConflict(b, "r1", "2030-01-07T01:30:00Z", "2030-01-07T02:30:00Z")?.id).toBe("a");
    expect(roomConflict(b, "r1", "2030-01-07T02:00:00Z", "2030-01-07T03:00:00Z")).toBeNull();
    expect(roomConflict(b, "r1", "2030-01-07T00:00:00Z", "2030-01-07T01:00:00Z")).toBeNull();
    expect(roomConflict(b, "r3", "2030-01-07T01:30:00Z", "2030-01-07T02:30:00Z")).toBeNull();
    expect(roomConflict(b, "r1", "2030-01-07T01:30:00Z", "2030-01-07T02:30:00Z", "a")).toBeNull();
  });
  it("장소 = 회의실 이름 · 적은 장소", () => {
    expect(placeLabel({ room_name: "3층 회의실", location: "빔 프로젝터" })).toBe("3층 회의실 · 빔 프로젝터");
    expect(placeLabel({ room_name: null, location: "거래처" })).toBe("거래처");
    expect(placeLabel({ room_name: null, location: " " })).toBeNull();
  });
});
