import { describe, expect, it } from "vitest";
import { formatMockAlimtalk } from "./mock-format";
import { approvalCompleted, approvalRejected, approvalRequest, maskPhone, merchantSummary, normalizePhone, paymentSummary, payoutCompleted } from "./templates";

describe("알림톡 템플릿 (notification-rule.md §2)", () => {
  it("결재 요청", () => {
    const m = approvalRequest({ companyId: "c", claimId: "k", name: "김개발", department: "개발팀", title: "부산 출장", total: 72000, count: 3, corporate: 2, personal: 1, merchant: "코레일 외 2곳" });
    expect(m.text).toBe("[PocketExpense] 새로운 지출결의서가 상신되었습니다.\n상신자: 김개발 (개발팀)\n제목: 부산 출장\n금액: 72,000 원 (영수증 3장)\n사용처: 코레일 외 2곳\n결제수단: 법인 2 · 사비 1");
    expect(m.buttonPath).toBe("/workspace/c/approvals/k");
    expect(m.vars).toMatchObject({ 상신자: "김개발 (개발팀)", 사용처: "코레일 외 2곳" });
  });
  it("승인: 직원명·금액·사용처·완료 문구, 사비 있음 / 법인카드만", () => {
    const m = approvalCompleted({ companyId: "c", claimId: "k", name: "김개발", title: "t", total: 10000, payout: 10000, merchant: "김밥천국" });
    expect(m.text).toBe("[PocketExpense] 결재가 정상 완료되었습니다. ✅\n신청자: 김개발\n제목: t\n금액: 10,000 원\n사용처: 김밥천국\n상태: 사비 10,000원 지급 대기 중입니다.");
    expect(approvalCompleted({ companyId: "c", claimId: "k", name: "a", title: "t", total: 10000, payout: 0, merchant: "-" }).text).toContain("법인카드 사용 건으로 정상 마감 처리되었습니다.");
  });
  it("반려는 사유 필수 포함·편집 화면으로", () => {
    const m = approvalRejected({ companyId: "c", claimId: "k", name: "김개발", title: "t", total: 5000, merchant: "스타벅스", reason: "날짜 확인" });
    expect(m.text).toBe("[PocketExpense] 지출결의서가 반려되었습니다. 🔴\n신청자: 김개발\n제목: t\n금액: 5,000 원\n사용처: 스타벅스\n반려 사유: 날짜 확인");
    expect(m.buttonPath).toBe("/workspace/c/employee/claims/k/edit");
    expect(approvalRejected({ companyId: "c", claimId: "k", name: "a", title: "t", total: 1, merchant: "-", reason: "  " }).vars?.["반려 사유"]).toBe("결의서에서 확인해 주세요");
  });
  it("사용처 요약", () => {
    expect(merchantSummary([])).toBe("-");
    expect(merchantSummary([null, " "])).toBe("-");
    expect(merchantSummary(["김밥천국", "김밥천국"])).toBe("김밥천국");
    expect(merchantSummary(["코레일", null, "도로공사", "부산국밥", "코레일"])).toBe("코레일 외 2곳");
  });
  it("Mock 콘솔 출력: 템플릿 이름·가린 번호·본문·버튼·변수", () => {
    const m = approvalRejected({ companyId: "c", claimId: "k", name: "김개발", title: "t", total: 5000, merchant: "스타벅스", reason: "날짜 확인" });
    const out = formatMockAlimtalk({ to: "01012345678", template: m.template, text: m.text, buttonLabel: m.buttonLabel, buttonUrl: "https://x.test/p", vars: m.vars }, null);
    expect(out).toContain("📨 알림톡 [MOCK] 결재 반려 (관리자 → 직원)");
    expect(out).toContain("템플릿 ID: (미등록)");
    expect(out).toContain("받는 사람: 010-****-5678");
    expect(out).not.toContain("01012345678");
    expect(out).toContain("│ 반려 사유: 날짜 확인");
    expect(out).toContain("│ [수정 후 재상신하기] https://x.test/p");
    expect(out).toContain("#{반려 사유} = 날짜 확인");
    expect(formatMockAlimtalk({ to: "01012345678", template: "INVITE", text: "a", buttonLabel: "b", buttonUrl: "u" }, "TPL_1")).toContain("템플릿 ID: TPL_1");
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

describe("미제출자 독촉 (REMINDER)", () => {
  it("문구·버튼", async () => {
    const { reminder } = await import("./templates");
    const m = reminder({ companyId: "c1", companyName: "포켓컴퍼니", pending: 2 });
    expect(m.template).toBe("REMINDER");
    expect(m.text).toBe("포켓컴퍼니 아직 제출하지 않은 지출결의서가 있어요 (작성중·반려 2건). 확인 후 상신해 주세요.");
    expect(m.buttonPath).toBe("/workspace/c1/employee");
  });
});
