import { describe, expect, it } from "vitest";
import { normalizeAiIntent, parseDay, ruleIntent } from "./intent";

const T = "2026-11-05";

describe("parseDay (D-222)", () => {
  it("오늘·내일·모레·글피", () => {
    expect(parseDay("오늘 일정", T)).toBe("2026-11-05");
    expect(parseDay("내일 회의실", T)).toBe("2026-11-06");
    expect(parseDay("모레", T)).toBe("2026-11-07");
    expect(parseDay("글피", T)).toBe("2026-11-08");
  });
  it("11월 7일 · 11/7 · 9일", () => {
    expect(parseDay("11월 7일 일정", T)).toBe("2026-11-07");
    expect(parseDay("11/20 회의실", T)).toBe("2026-11-20");
    expect(parseDay("9일 일정", T)).toBe("2026-11-09");
    expect(parseDay("일정", T)).toBeNull();
  });
});

describe("ruleIntent (D-222)", () => {
  it("일정", () => {
    expect(ruleIntent("오늘 일정 알려줘", T)).toEqual({ tool: "schedule", day: "2026-11-05" });
    expect(ruleIntent("@WORKON 내일 스케줄", T)).toEqual({ tool: "schedule", day: "2026-11-06" });
  });
  it("회의실 빈 시간(방 이름)", () => {
    expect(ruleIntent("내일 회의실 빈 시간", T)).toEqual({ tool: "rooms", day: "2026-11-06" });
    expect(ruleIntent("3층 회의실 오늘 언제 비어 있어?", T)).toEqual({ tool: "rooms", day: "2026-11-05", room: "3층 회의실" });
  });
  it("결의서·승인", () => {
    expect(ruleIntent("반려된 결의서 있어?", T)).toEqual({ tool: "my_claims", filter: "rejected" });
    expect(ruleIntent("임시저장한 결의서", T)).toEqual({ tool: "my_claims", filter: "draft" });
    expect(ruleIntent("내 경비 남은 거 있어?", T)).toEqual({ tool: "my_claims", filter: "open" });
    expect(ruleIntent("승인 대기 몇 건?", T)).toEqual({ tool: "approvals" });
  });
  it("화면 열기", () => {
    expect(ruleIntent("회의실 예약 화면 열어줘", T)).toEqual({ tool: "open", target: "rooms" });
    expect(ruleIntent("새 결의서 쓰기", T)).toEqual({ tool: "open", target: "new_claim" });
    expect(ruleIntent("캘린더 열어줘", T)).toEqual({ tool: "open", target: "calendar" });
  });
  it("도움말·못 알아들음", () => {
    expect(ruleIntent("뭐 할 수 있어?", T)).toEqual({ tool: "help" });
    expect(ruleIntent("우리 회사 매출 분석해줘", T)).toBeNull();
  });
});

describe("normalizeAiIntent", () => {
  it("모르는 값은 unsupported, 날짜 이상하면 오늘", () => {
    expect(normalizeAiIntent({ tool: "delete_everything" }, T)).toEqual({ tool: "unsupported" });
    expect(normalizeAiIntent({ tool: "schedule", day: "내일" }, T)).toEqual({ tool: "schedule", day: T });
    expect(normalizeAiIntent({ tool: "open", target: "hack" }, T)).toEqual({ tool: "unsupported" });
    expect(normalizeAiIntent({ tool: "rooms", day: "2026-11-09", room: "소회의실" }, T)).toEqual({ tool: "rooms", day: "2026-11-09", room: "소회의실" });
  });
});
