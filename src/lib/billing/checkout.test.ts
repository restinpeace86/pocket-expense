import { describe, expect, it } from "vitest";
import { checkoutPrice } from "./checkout";

describe("결제 금액 (D-134)", () => {
  it("첫 결제는 월간 정가 50% 할인 + 부가세 10%", () => {
    expect(checkoutPrice(29000, true)).toEqual({ list: 29000, discount: 14500, supply: 14500, vat: 1450, total: 15950, firstPurchase: true });
    expect(checkoutPrice(49000, true).total).toBe(26950);
    expect(checkoutPrice(89000, true).supply).toBe(44500);
  });
  it("첫 결제가 아니면 정가", () => {
    expect(checkoutPrice(49000, false)).toEqual({ list: 49000, discount: 0, supply: 49000, vat: 4900, total: 53900, firstPurchase: false });
  });
});
