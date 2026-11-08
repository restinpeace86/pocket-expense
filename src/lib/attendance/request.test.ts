import { describe, expect, it } from "vitest";
import { applyChip, changeLines, kstDate, requestErrorText, validateRequest } from "./request";

describe("정정 신청 검사(D-239)", () => {
  const before = { inTime: "09:03", outTime: "18:00" };
  const ok = { date: "2026-11-18", kind: "correction" as const, newIn: "09:03", newOut: "20:30", reason: "퇴근 뒤 더 일했어요" };
  it("정상", () => expect(validateRequest(ok, before, "2026-11-20", "10:00")).toBeNull());
  it("출근 < 퇴근, 자정 넘은 시각 없음", () => expect(validateRequest({ ...ok, newOut: "08:00" }, before, "2026-11-20", "10:00")).toContain("늦어야"));
  it("오늘은 지금까지만", () => expect(validateRequest({ ...ok, date: "2026-11-20" }, before, "2026-11-20", "19:00")).toContain("오지 않은"));
  it("바뀐 것 없음", () => expect(validateRequest({ ...ok, newOut: "18:00" }, before, "2026-11-20", "10:00")).toBe("바뀐 시각이 없어요."));
  it("휴일 상신은 시각 그대로여도 됨, 한 일 필수", () => {
    expect(validateRequest({ ...ok, kind: "holiday", newOut: "18:00" }, before, "2026-11-20", "10:00")).toBeNull();
    expect(validateRequest({ ...ok, kind: "holiday", reason: " " }, before, "2026-11-20", "10:00")).toBe("한 일을 적어 주세요.");
  });
  it("빠른 선택", () => {
    expect(applyChip("", "외근·출장")).toBe("외근·출장");
    expect(applyChip("퇴근을 못 찍었어요", "외근·출장")).toBe("외근·출장");
    expect(applyChip("견적 마감", "퇴근 뒤 더 일했어요")).toBe("퇴근 뒤 더 일했어요 — 견적 마감");
    expect(applyChip("퇴근 뒤 더 일했어요 — 견적 마감", "외근·출장")).toBe("외근·출장 — 견적 마감");
  });
  it("바뀐 줄", () => {
    expect(changeLines({ before: { in_at: "2026-11-18T00:03:00Z", out_at: "2026-11-18T09:00:00Z", out_method: "auto" }, new_in: "09:03", new_out: "20:30" })).toEqual([
      { label: "퇴근", from: "18:00 (자동)", to: "20:30" },
    ]);
    expect(changeLines({ before: {}, new_in: "09:00", new_out: "18:00" })).toEqual([
      { label: "출근", from: "기록 없음", to: "09:00" },
      { label: "퇴근", from: "기록 없음", to: "18:00" },
    ]);
  });
  it("도우미", () => {
    expect(kstDate("2026-11-18T15:30:00Z")).toBe("2026-11-19");
    expect(requestErrorText("OUT_OF_RANGE")).toBe("정정 신청은 이번 달 기록만 할 수 있어요.");
  });
});
