import { describe, expect, it } from "vitest";
import { checkoutPrice } from "./checkout";

describe("결제 금액 (D-134 → D-201)", () => {
  it("후기 쿠폰이 있으면 첫 결제 월간 정가 50% 할인 + 부가세 10%", () => {
    expect(checkoutPrice(29000, true)).toEqual({ list: 29000, discount: 14500, supply: 14500, vat: 1450, total: 15950, coupon: true });
    expect(checkoutPrice(49000, true).total).toBe(26950);
    expect(checkoutPrice(89000, true).supply).toBe(44500);
  });
  it("쿠폰이 없으면 정가(모든 회사 첫 결제 할인은 없음)", () => {
    expect(checkoutPrice(49000, false)).toEqual({ list: 49000, discount: 0, supply: 49000, vat: 4900, total: 53900, coupon: false });
  });
});
