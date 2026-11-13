import { describe, expect, it } from "vitest";
import { budgetErrorMessage, budgetPct, budgetTone, parseBudgetInput } from "./format";

describe("예산 계산 (D-267)", () => {
  it("비율: 예산이 없으면 null, 반올림", () => {
    expect(budgetPct(900_000, 1_000_000)).toBe(90);
    expect(budgetPct(1, 3)).toBe(33);
    expect(budgetPct(100, null)).toBeNull();
    expect(budgetPct(100, 0)).toBeNull();
  });
  it("색 단계: 80% 주의 · 100% 넘음", () => {
    expect(budgetTone(null)).toBe("none");
    expect(budgetTone(79)).toBe("ok");
    expect(budgetTone(80)).toBe("warn");
    expect(budgetTone(100)).toBe("over");
  });
  it("입력: 콤마·원 허용, 빈 칸 = 예산 없음, 잘못된 값", () => {
    expect(parseBudgetInput("4,000,000원")).toBe(4_000_000);
    expect(parseBudgetInput("  ")).toBeNull();
    expect(parseBudgetInput("0")).toBe("invalid");
    expect(parseBudgetInput("12만")).toBe("invalid");
    expect(parseBudgetInput("3000000000")).toBe("invalid");
  });
  it("오류 문구", () => {
    expect(budgetErrorMessage("PLAN_REQUIRED")).toContain("프로 플랜");
    expect(budgetErrorMessage("??")).toContain("잠시 뒤");
  });
});
