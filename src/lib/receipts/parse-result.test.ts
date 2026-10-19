import { describe, expect, it } from "vitest";
import { normalizeParsed } from "./parse-result";

describe("normalizeParsed", () => {
  it("정상 값은 그대로, 숫자는 정리", () => {
    const r = normalizeParsed(
      {
        merchant_name: " 스타벅스 강남점 ",
        merchant_business_number: "123-45-67890",
        card_last4: "7890",
        suggested_evidence_type: "card_slip",
        amount: "45,000",
        supply_amount: 40909,
        vat_amount: 4091,
        expense_date: "2026-10-16",
        suggested_category: "meeting",
      },
      "2026-10-20",
    );
    expect(r).toMatchObject({ merchant_name: "스타벅스 강남점", merchant_business_number: "1234567890", card_last4: "7890", amount: 45000, expense_date: "2026-10-16", suggested_category: "meeting" });
  });
  it("범위 밖·형식 오류는 비운다", () => {
    const r = normalizeParsed(
      { merchant_business_number: "12345", card_last4: "1234-5678-9012-3456", amount: -100, expense_date: "2026-10-21", suggested_category: "travel", suggested_trip_type: "own_car", suggested_evidence_type: "other" },
      "2026-10-20",
    );
    expect(r).toMatchObject({ merchant_business_number: null, card_last4: null, amount: null, expense_date: null, suggested_category: null, suggested_trip_type: null, suggested_evidence_type: null });
  });
  it("참고 정보: 시각·승인번호·주소·품목", () => {
    const r = normalizeParsed(
      {
        paid_time: "12:41:09",
        approval_number: "3001-2345",
        merchant_address: " 서울 강남구 테헤란로 123 ",
        line_items: [{ name: "참치김밥", quantity: "2", unit_price: 4500, amount: 9000 }, { name: "할인", amount: "-1,000" }, { name: " " }, "x"],
      },
      "2026-10-20",
    );
    expect(r).toMatchObject({ paid_time: "12:41", approval_number: "30012345", merchant_address: "서울 강남구 테헤란로 123" });
    expect(r.line_items).toEqual([
      { name: "참치김밥", quantity: 2, unit_price: 4500, amount: 9000 },
      { name: "할인", quantity: null, unit_price: null, amount: -1000 },
    ]);
    expect(normalizeParsed({ paid_time: "25:00", approval_number: "12", line_items: "no" }, "2026-10-20")).toMatchObject({ paid_time: null, approval_number: null, line_items: [] });
  });
  it("객체가 아니면 모두 null", () => {
    expect(normalizeParsed("oops", "2026-10-20").amount).toBeNull();
  });
});
