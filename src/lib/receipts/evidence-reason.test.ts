import { describe, expect, it } from "vitest";
import { evidenceReason } from "./evidence-reason";

const ai = (suggested: Parameters<typeof evidenceReason>[1] extends infer T ? (T extends { suggested: infer S } ? S : never) : never, hasApproval = false, hasCardNumber = false) => ({ suggested, hasApproval, hasCardNumber });

describe("evidenceReason — AI 판별 이유", () => {
  it("예시 문구", () => {
    expect(evidenceReason("card_slip", ai("card_slip", true))).toBe("카드 승인번호를 확인했어요");
    expect(evidenceReason("cash_receipt", ai("cash_receipt"))).toBe("현금영수증 번호가 확인되었어요");
    expect(evidenceReason("tax_invoice", ai("tax_invoice"))).toBe("세금계산서 항목으로 확인했어요");
    expect(evidenceReason("simple_receipt", ai("simple_receipt"))).toBe("별도 승인번호가 없어 간이 영수증으로 분류했어요");
  });
  it("카드: 승인번호가 없으면 카드번호, 그것도 없으면 일반 문구", () => {
    expect(evidenceReason("card_slip", ai("card_slip", false, true))).toBe("카드번호를 확인했어요");
    expect(evidenceReason("card_slip", ai("card_slip"))).toBe("카드 결제 영수증으로 확인했어요");
  });
  it("AI가 못 가렸으면 기본값 안내, 직원이 바꿨거나 AI 결과가 없으면 이유 없음", () => {
    expect(evidenceReason("card_slip", ai(null))).toMatch(/카드매출전표로 두었어요/);
    expect(evidenceReason("cash_receipt", ai(null))).toBeNull();
    expect(evidenceReason("tax_invoice", ai("card_slip", true))).toBeNull();
    expect(evidenceReason("card_slip", null)).toBeNull();
    expect(evidenceReason(null, ai("card_slip"))).toBeNull();
  });
});
