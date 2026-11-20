import { describe, expect, it } from "vitest";
import { subscriptionCharge } from "./checkout";
import { cardLabel, orderId, parseCharge, tossAuthHeader } from "./toss-format";

describe("토스 자동결제 다듬기(D-298)", () => {
  it("인증 헤더 = Basic base64(키:)", () => {
    expect(tossAuthHeader("test_sk_x")).toBe("Basic " + Buffer.from("test_sk_x:").toString("base64"));
  });
  it("카드 표시는 카드사 + 가린 번호", () => {
    expect(cardLabel({ issuerCode: "41", number: "46730900****000*" })).toBe("신한 4673-0900-****-000*");
    expect(cardLabel({ issuerCode: "zz", number: null })).toBe("카드");
    expect(cardLabel(null)).toBe("카드");
  });
  it("주문번호는 6~64자, 영문·숫자·-만", () => {
    const id = orderId("c1050000-0000-0000-0000-00000000000a", "renewal", 1_800_000_000_000);
    expect(id.length).toBeGreaterThanOrEqual(6);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(orderId("c1", "first")).not.toBe(orderId("c1", "first"));
  });
  it("승인 응답: 성공·금액 다름·카드 거절·서버 오류", () => {
    expect(parseCharge(200, { status: "DONE", paymentKey: "pk", totalAmount: 53900, receipt: { url: "u" } }, 53900)).toEqual({ ok: true, paymentKey: "pk", receiptUrl: "u", totalAmount: 53900 });
    expect(parseCharge(200, { status: "DONE", paymentKey: "pk", totalAmount: 100 }, 53900)).toMatchObject({ ok: false, code: "AMOUNT_MISMATCH" });
    expect(parseCharge(400, { code: "REJECT_CARD_COMPANY", message: "한도 초과" }, 1)).toEqual({ ok: false, code: "REJECT_CARD_COMPANY", message: "한도 초과", retryable: false });
    expect(parseCharge(500, {}, 1)).toMatchObject({ ok: false, retryable: true });
  });
  it("결제 금액 = 요금제(쿠폰이면 50%) + 저장 공간 + 부가세", () => {
    expect(subscriptionCharge(49000, 0, false)).toMatchObject({ supply: 49000, vat: 4900, total: 53900 });
    expect(subscriptionCharge(49000, 10000, true)).toMatchObject({ discount: 24500, supply: 34500, vat: 3450, total: 37950, plan: 49000, storage: 10000 });
  });
});
