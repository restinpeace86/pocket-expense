import { describe, expect, it } from "vitest";
import { approvalCompleted, approvalRejected, approvalRequest, maskPhone, normalizePhone, paymentSummary, payoutCompleted } from "./templates";

describe("알림톡 템플릿 (notification-rule.md §2)", () => {
  it("결재 요청", () => {
    const m = approvalRequest({ companyId: "c", claimId: "k", name: "김개발", department: "개발팀", title: "부산 출장", total: 72000, count: 3, corporate: 2, personal: 1 });
    expect(m.text).toBe("[PocketExpense] 새로운 지출소명서가 상신되었습니다.\n상신자: 김개발 (개발팀)\n제목: 부산 출장\n금액: 72,000 원 (영수증 3장)\n결제수단: 법인 2 · 사비 1");
    expect(m.buttonPath).toBe("/workspace/c/approvals/k");
  });
  it("승인: 사비 있음 / 법인카드만", () => {
    expect(approvalCompleted({ companyId: "c", claimId: "k", title: "t", total: 10000, payout: 10000 }).text).toContain("사비 10,000원 지급 대기 중입니다.");
    expect(approvalCompleted({ companyId: "c", claimId: "k", title: "t", total: 10000, payout: 0 }).text).toContain("법인카드 사용 건으로 정상 마감 처리되었습니다.");
  });
  it("반려는 편집 화면으로", () => {
    const m = approvalRejected({ companyId: "c", claimId: "k", title: "t", reason: "날짜 확인" });
    expect(m.text).toContain("반려 사유: 날짜 확인");
    expect(m.buttonPath).toBe("/workspace/c/employee/claims/k/edit");
  });
  it("지급 완료", () => {
    expect(payoutCompleted({ companyId: "c", title: "t", payout: 42000, paidAt: "2026.10.20 14:00" }).text).toContain("지급 금액: 42,000 원\n지급 일시: 2026.10.20 14:00");
  });
  it("결제수단 요약·번호 검사·가리기", () => {
    expect(paymentSummary(1, 0)).toBe("법인카드");
    expect(paymentSummary(0, 2)).toBe("사비");
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("02-123-4567")).toBeNull();
    expect(maskPhone("01012345678")).toBe("010-****-5678");
  });
});
