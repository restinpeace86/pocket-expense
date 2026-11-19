import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSolapiResponse, solapiAuthHeader, solapiBody, solapiVariables } from "./solapi-format";
import { approvalCompleted, renderAlimtalk } from "./templates";

describe("솔라피 알림톡 요청·응답 (D-297)", () => {
  it("인증 머리글: HMAC-SHA256(secret, date + salt)", () => {
    const date = "2026-11-19T01:02:03.000Z";
    const h = solapiAuthHeader("KEY", "SECRET", date, "abc");
    const sig = createHmac("sha256", "SECRET").update(date + "abc").digest("hex");
    expect(h).toBe(`HMAC-SHA256 apiKey=KEY, date=${date}, salt=abc, signature=${sig}`);
  });

  it("변수는 #{이름} 열쇠로, 버튼 링크 변수(앞 / 없음)도 함께", () => {
    const m = approvalCompleted({ companyId: "c1", claimId: "k1", name: "김개발", title: "점심", total: 15000, payout: 15000, merchant: "김밥천국" });
    const v = solapiVariables(m.vars);
    expect(v).toEqual({
      "#{신청자}": "김개발",
      "#{제목}": "점심",
      "#{금액}": "15,000 원",
      "#{사용처}": "김밥천국",
      "#{정산}": "사비 15,000원 지급 예정",
      "#{링크}": "workspace/c1/employee/claims/k1",
    });
    // 템플릿 글의 모든 칸이 변수에 있다(심사 글과 같게)
    const holes = [...m.text.matchAll(/#\{([^}]+)\}/g)];
    expect(holes).toHaveLength(0);
  });

  it("본문: 번호는 숫자만, 문자 대체 발송 끔, 발신번호는 있을 때만", () => {
    const m = renderAlimtalk("APPROVAL_REJECTED", { 신청자: "김", 제목: "t", 금액: "1 원", 사용처: "m", 반려사유: "흐림" }, "/workspace/c/x");
    const b = solapiBody({ to: "010-1234-5678", vars: m.vars }, "TPL1", { pfId: "PF1", from: null });
    expect(b.showMessageList).toBe(true);
    expect(b.messages[0]).toEqual({ to: "01012345678", kakaoOptions: { pfId: "PF1", templateId: "TPL1", variables: solapiVariables(m.vars), disableSms: true } });
    expect(solapiBody({ to: "01011112222" }, "T", { pfId: "P", from: "010-9982-0958" }).messages[0]).toMatchObject({ from: "01099820958" });
  });

  it("응답 읽기: 접수 성공·접수 실패·4xx·5xx", () => {
    expect(parseSolapiResponse(200, { groupInfo: { groupId: "G1" }, failedMessageList: [], messageList: [{ messageId: "M1", statusCode: "2000" }] })).toEqual({ ok: true, providerMessageId: "M1" });
    expect(parseSolapiResponse(200, { groupInfo: { groupId: "G1" }, failedMessageList: [] })).toEqual({ ok: true, providerMessageId: "G1" });
    const f = parseSolapiResponse(200, { failedMessageList: [{ statusCode: "3034", statusMessage: "템플릿 불일치" }] });
    expect(f).toMatchObject({ ok: false, retryable: false });
    expect(!f.ok && f.error).toContain("3034");
    expect(parseSolapiResponse(400, { errorCode: "ValidationError", errorMessage: "bad" })).toMatchObject({ ok: false, retryable: false });
    expect(parseSolapiResponse(503, null)).toMatchObject({ ok: false, retryable: true });
    expect(parseSolapiResponse(429, {})).toMatchObject({ ok: false, retryable: true });
  });
});
