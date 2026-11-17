import { describe, expect, it } from "vitest";
import type { Field } from "@/lib/company-forms/model";
import { fitSigners } from "@/lib/company-forms/fill";
import { displayValue, isEmpty, missingFields, progressLine } from "./model";

const f = (key: string, type: Field["b"] extends infer B ? (B extends { k: "input"; type: infer T } ? T : never) : never, required: boolean, r: number): Field => ({ key, label: key, s: 0, r, c: 1, b: { k: "input", type, required } });

describe("결재 문서 값 보이기(9-33e)", () => {
  it("금액·날짜·기간·시각을 양식 글로", () => {
    expect(displayValue("money", "2200000")).toBe("2,200,000원");
    expect(displayValue("date", "2026-11-20")).toBe("2026.11.20");
    expect(displayValue("period", "2026-11-20~2026-12-15")).toBe("2026.11.20 ~ 2026.12.15 (26일)");
    expect(displayValue("period", "2026-11-20~2026-11-20")).toBe("2026.11.20");
    expect(displayValue("time_range", "09:00~11:30")).toBe("09:00 ~ 11:30");
    expect(displayValue("text", "  A사 ")).toBe("A사");
    expect(displayValue("money", undefined)).toBe("");
  });
  it("비었나: 기간은 둘 다 있어야, 목록은 하나 이상", () => {
    expect(isEmpty("2026-11-20~")).toBe(true);
    expect(isEmpty("2026-11-20~2026-11-21")).toBe(false);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty(" ")).toBe(true);
  });
  it("필수 칸만, 양식 위→아래 순서로", () => {
    const fields = [f("b", "text", true, 2), f("a", "money", true, 1), f("c", "long", false, 3)];
    expect(missingFields(fields, {}).map((x) => x.key)).toEqual(["a", "b"]);
    expect(missingFields(fields, { a: "1", b: "x" })).toEqual([]);
  });
  it("진행 한 줄", () => {
    const steps = [
      { round: 1, step_kind: "review" as const, status: "pending" as const, approver_name: "김팀장", acted_by_name: null },
      { round: 1, step_kind: "final" as const, status: "waiting" as const, approver_name: null, acted_by_name: null },
    ];
    expect(progressLine("submitted", steps, 1, false)).toBe("김팀장 검토 중");
    expect(progressLine("draft", [], 0, false)).toBe("올리기 전");
    expect(progressLine("approved", [], 1, true)).toBe("대표 본인 승인");
  });
});

describe("결재란 칸 수 맞추기(9-33e)", () => {
  const p = (n: string) => ({ name: n, position: null, date: null });
  it("칸이 모자라면 앞 칸들 + 마지막 칸 = 최종 승인자", () => {
    expect(fitSigners([p("쓴"), p("검1"), p("검2"), p("최종")], 3).map((x) => (typeof x === "string" ? x : x?.name))).toEqual(["쓴", "검1", "최종"]);
    expect(fitSigners([p("쓴"), "pending"], 5)).toHaveLength(2);
  });
});
