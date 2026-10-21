import { describe, expect, it } from "vitest";
import { cardNumberMatches, formatCardNumber, formatMaskedCard, maskCardNumber, matchCard } from "./match";

const A = { id: "a", bin6: "532712", last4: "4321" };
const B = { id: "b", bin6: "943011", last4: "4321" }; // 뒤 4자리가 A와 같은 다른 카드
const C = { id: "c", bin6: null, last4: "7890" }; // 앞 6자리 미등록(예전 카드)

describe("maskCardNumber", () => {
  it("구분자를 지우고 숫자와 *만 남긴다", () => {
    expect(maskCardNumber("5327-12**-****-4321")).toBe("532712******4321");
    expect(maskCardNumber("5327 12XX XXXX 432*")).toBe("532712******432*");
  });
  it("전체 번호가 와도 앞 6자리·뒤 4자리 말고는 가린다", () => {
    expect(maskCardNumber("5327123456784321")).toBe("532712******4321");
  });
  it("짧게 찍힌 번호는 뒤 4자리만 남긴다", () => {
    expect(maskCardNumber("****7890")).toBe("****7890");
    expect(maskCardNumber("12347890")).toBe("****7890");
    expect(maskCardNumber("7890")).toBe("7890");
  });
  it("보이는 숫자가 없거나 너무 짧으면 null", () => {
    expect(maskCardNumber("****-****-****-****")).toBeNull();
    expect(maskCardNumber("12")).toBeNull();
    expect(maskCardNumber(null)).toBeNull();
  });
});

describe("cardNumberMatches", () => {
  it("가려진 자리는 비교하지 않는다", () => {
    expect(cardNumberMatches("532712******432*", A)).toBe(true);
    expect(cardNumberMatches("5327********4321", A)).toBe(true);
  });
  it("보이는 숫자가 하나라도 다르면 false", () => {
    expect(cardNumberMatches("532712******4329", A)).toBe(false);
    expect(cardNumberMatches("943011******4321", A)).toBe(false);
  });
  it("앞 6자리 미등록 카드는 뒤 4자리로만 비교", () => {
    expect(cardNumberMatches("111111******7890", C)).toBe(true);
  });
  it("비교할 숫자가 없으면 null", () => {
    expect(cardNumberMatches("************", A)).toBeNull();
  });
});

describe("matchCard", () => {
  it("앞 6자리로 뒤 4자리가 같은 카드를 구분한다", () => {
    expect(matchCard("943011******4321", [A, B, C])).toEqual({ kind: "unique", cardId: "b" });
  });
  it("뒤 4자리만 보이면 같은 끝자리 카드끼리는 정하지 못한다", () => {
    expect(matchCard("****4321", [A, B, C])).toEqual({ kind: "ambiguous", cardIds: ["a", "b"] });
  });
  it("어느 카드와도 안 맞으면 mismatch, 숫자가 없으면 unknown", () => {
    expect(matchCard("****1111", [A, B, C])).toEqual({ kind: "mismatch" });
    expect(matchCard(null, [A])).toEqual({ kind: "unknown" });
  });
});

describe("표시", () => {
  it("4자리씩 끊어 보여 준다", () => {
    expect(formatMaskedCard("532712******432*")).toBe("5327-12**-****-432*");
    expect(formatCardNumber(A)).toBe("5327-12**-****-4321");
    expect(formatCardNumber(C)).toBe("****-****-****-7890");
  });
});
