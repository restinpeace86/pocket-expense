import { describe, expect, it } from "vitest";
import { CHANNEL, needsAlimtalk, pushOf } from "./channel";
import { approvalRejected, approvalRequest, invite, payoutCompleted } from "./templates";
import { BRAND } from "@/lib/brand";

describe("알림 길 나누기 (D-213)", () => {
  it("초대는 늘 알림톡(받는 사람이 아직 회원이 아님)", () => {
    expect(needsAlimtalk("INVITE", true)).toBe(true);
    expect(needsAlimtalk("TAX_OFFICE_INVITE", false)).toBe(true);
  });
  it("결재 요청·반려·독촉·자료 요청은 앱 알림을 못 받았을 때만 알림톡", () => {
    for (const c of ["APPROVAL_REQUEST", "APPROVAL_REJECTED", "REMINDER", "TAX_REQUEST"] as const) {
      expect(needsAlimtalk(c, true)).toBe(false);
      expect(needsAlimtalk(c, false)).toBe(false); // 카카오 추가 서비스 꺼짐(기본) → 앱 안만(D-247)
      expect(needsAlimtalk(c, false, true)).toBe(true);
      expect(needsAlimtalk(c, true, true)).toBe(false);
    }
  });
  it("승인 완료·지급 완료·정기 결제·월말 마감·세무 마감은 앱 알림만", () => {
    for (const c of ["APPROVAL_COMPLETED", "PAYOUT_COMPLETED", "RECURRING_READY", "CLOSING", "TAX_CLOSED"] as const) {
      expect(needsAlimtalk(c, false)).toBe(false);
    }
  });
  it("알림톡이 꼭 가는 것은 2종뿐", () => {
    expect(Object.entries(CHANNEL).filter(([, v]) => v === "alimtalk").map(([k]) => k).sort()).toEqual(["INVITE", "TAX_OFFICE_INVITE"]);
  });
  it("앱 알림 문구: 머리말은 제목, 나머지 줄은 한 줄로", () => {
    const m = approvalRequest({ companyId: "c", claimId: "k", name: "김개발", department: null, title: "부산 출장", total: 72000, count: 3, corporate: 2, personal: 1, merchant: "코레일 외 2곳" });
    const p = pushOf(m, "claim-k");
    expect(p.title).toBe("결재 요청이 왔어요");
    expect(p.body).toBe("상신자: 김개발 · 제목: 부산 출장 · 금액: 72,000 원 (영수증 3장) · 사용처: 코레일 외 2곳 · 결제수단: 법인 2 · 사비 1");
    expect(p.url).toBe("/workspace/c/approvals/k");
    expect(p.tag).toBe("claim-k");
    expect(pushOf(approvalRejected({ companyId: "c", claimId: "k", name: "김", title: "t", total: 1, merchant: "m", reason: "영수증 흐림" })).body).toContain("반려 사유: 영수증 흐림");
    expect(pushOf(payoutCompleted({ companyId: "c", title: "t", payout: 1000, paidAt: "11/5" })).title).toBe("정산금이 지급됐어요");
    expect(pushOf(invite({ companyName: "회사", name: "김", token: "x" })).body).toContain(`회사에서 김님을 ${BRAND.name}에 초대했습니다.`);
  });
});
