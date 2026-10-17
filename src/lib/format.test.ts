import { describe, expect, it } from "vitest";
import { formatPhone, formatWon } from "./format";

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

describe("formatPhone", () => {
  it("숫자만 저장된 번호에 하이픈을 넣는다", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
    expect(formatPhone("0101235678")).toBe("010-123-5678");
  });

  it("형식이 다르면 그대로 보여 준다", () => {
    expect(formatPhone("12")).toBe("12");
  });
});
