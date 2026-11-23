import { describe, expect, it } from "vitest";
import { subscriptionCharge } from "./checkout";
import { cardLabel, issueId, orderId, parseBillingKeyInfo, parseChargeRequest, parsePayment, phoneDigits, portoneAuthHeader } from "./portone-format";

describe("포트원 V2 정기결제 다듬기(D-312)", () => {
  it("인증 헤더 = PortOne 키", () => {
    expect(portoneAuthHeader("sec")).toBe("PortOne sec");
  });
  it("카드 표시는 카드 이름 + 가린 번호", () => {
    expect(cardLabel({ name: "신한카드", number: "53651000****000*" })).toBe("신한카드 5365-1000-****-000*");
    expect(cardLabel({ publisher: "KB국민", number: null })).toBe("KB국민");
    expect(cardLabel(null)).toBe("카드");
  });
  it("결제 번호·카드 등록 번호는 영문·숫자·-만, 겹치지 않음", () => {
    const id = orderId("c1050000-0000-0000-0000-00000000000a", "renewal", 1_800_000_000_000);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(orderId("c1", "first")).not.toBe(orderId("c1", "first"));
    expect(issueId("2b0c8f3e-1111-2222-3333-444455556666", 1_800_000_000_000)).toMatch(/^card-[0-9a-f]{16}-[0-9a-z]+$/);
  });
  it("휴대폰은 숫자만", () => {
    expect(phoneDigits("010-1234-5678")).toBe("01012345678");
    expect(phoneDigits(null)).toBe("");
  });
  it("빌링키 확인: 이 구독 것만, 카드·구매자 정보", () => {
    const body = {
      status: "ISSUED",
      customer: { id: "ck", name: "테스트회사", email: "a@b.c", phoneNumber: "010-1111-2222" },
      methods: [{ type: "BillingKeyPaymentMethodCard", card: { name: "현대카드", number: "43302800****123*" } }],
    };
    expect(parseBillingKeyInfo(200, body, "ck")).toEqual({ ok: true, label: "현대카드 4330-2800-****-123*", customer: { name: "테스트회사", email: "a@b.c", phone: "01011112222" } });
    expect(parseBillingKeyInfo(200, body, "other")).toMatchObject({ ok: false });
    expect(parseBillingKeyInfo(200, { ...body, status: "DELETED" }, "ck")).toMatchObject({ ok: false });
    expect(parseBillingKeyInfo(404, { type: "BILLING_KEY_NOT_FOUND", message: "없음" }, "ck")).toEqual({ ok: false, message: "없음" });
  });
  it("결제 요청: 접수·카드사 거절은 재시도 안 함·서버 오류는 재시도", () => {
    expect(parseChargeRequest(200, { payment: { pgTxId: "t", paidAt: "2026-11-23T00:00:00Z" } })).toEqual({ ok: true });
    expect(parseChargeRequest(502, { type: "PG_PROVIDER", message: "x", pgCode: "1001", pgMessage: "한도 초과" })).toEqual({ ok: false, code: "PG_1001", message: "한도 초과", retryable: false });
    expect(parseChargeRequest(409, { type: "ALREADY_PAID" })).toMatchObject({ ok: false, retryable: false });
    expect(parseChargeRequest(500, {})).toMatchObject({ ok: false, retryable: true });
    expect(parseChargeRequest(0, { type: "NETWORK", message: "연결 안 됨" })).toMatchObject({ ok: false, retryable: true });
  });
  it("결제 조회: 결제됨·금액 다름·실패", () => {
    expect(parsePayment(200, { status: "PAID", id: "p1", transactionId: "tx", amount: { total: 53900 }, receiptUrl: "u" }, 53900)).toEqual({ ok: true, paymentKey: "tx", receiptUrl: "u", totalAmount: 53900 });
    expect(parsePayment(200, { status: "PAID", id: "p1", amount: { total: 100 } }, 53900)).toMatchObject({ ok: false, code: "AMOUNT_MISMATCH" });
    expect(parsePayment(200, { status: "FAILED", id: "p1", failure: { pgCode: "51", pgMessage: "잔액 부족" } }, 1)).toEqual({ ok: false, code: "PG_51", message: "잔액 부족", retryable: false });
  });
  it("결제 금액 = 요금제(쿠폰이면 50%) + 저장 공간 + 부가세", () => {
    expect(subscriptionCharge(49000, 0, false)).toMatchObject({ supply: 49000, vat: 4900, total: 53900 });
    expect(subscriptionCharge(49000, 10000, true)).toMatchObject({ discount: 24500, supply: 34500, vat: 3450, total: 37950, plan: 49000, storage: 10000 });
  });
});
