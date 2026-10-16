import { describe, expect, it } from "vitest";
import { formatWon } from "./format";

describe("formatWon", () => {
  it("천 단위 콤마와 원을 붙인다", () => {
    expect(formatWon(72000)).toBe("72,000원");
    expect(formatWon(0)).toBe("0원");
  });

  it("소수는 원 단위로 반올림한다", () => {
    expect(formatWon(25679.6)).toBe("25,680원");
  });

  it("숫자가 아니면 오류를 낸다", () => {
    expect(() => formatWon(Number.NaN)).toThrow();
  });
});
