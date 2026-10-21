// 알림톡 템플릿 6종 문구 (spec/screens/notification-rule.md §2 — 문구의 단일 기준). 링크에는 토큰을 넣지 않는다(D-013).
export type TemplateCode = "APPROVAL_REQUEST" | "APPROVAL_COMPLETED" | "APPROVAL_REJECTED" | "PAYOUT_COMPLETED" | "INVITE" | "REMINDER";

export type BuiltMessage = { template: TemplateCode; text: string; buttonLabel: string; buttonPath: string };

const won = (n: number) => n.toLocaleString("ko-KR");

export function paymentSummary(corporate: number, personal: number): string {
  if (corporate && personal) return `법인 ${corporate} · 사비 ${personal}`;
  if (corporate) return "법인카드";
  if (personal) return "사비";
  return "-";
}

export function approvalRequest(p: { companyId: string; claimId: string; name: string; department: string | null; title: string; total: number; count: number; corporate: number; personal: number }): BuiltMessage {
  return {
    template: "APPROVAL_REQUEST",
    text: [
      "[PocketExpense] 새로운 지출결의서가 상신되었습니다.",
      `상신자: ${p.name}${p.department ? ` (${p.department})` : ""}`,
      `제목: ${p.title}`,
      `금액: ${won(p.total)} 원 (영수증 ${p.count}장)`,
      `결제수단: ${paymentSummary(p.corporate, p.personal)}`,
    ].join("\n"),
    buttonLabel: "결재하러 가기",
    buttonPath: `/workspace/${p.companyId}/approvals/${p.claimId}`,
  };
}

export function approvalCompleted(p: { companyId: string; claimId: string; title: string; total: number; payout: number }): BuiltMessage {
  return {
    template: "APPROVAL_COMPLETED",
    text: [
      "[PocketExpense] 지출결의서가 승인되었습니다. ✅",
      `제목: ${p.title}`,
      `금액: ${won(p.total)} 원`,
      `상태: ${p.payout > 0 ? `사비 ${won(p.payout)}원 지급 대기 중입니다.` : "법인카드 사용 건으로 정상 마감 처리되었습니다."}`,
    ].join("\n"),
    buttonLabel: "내 내역 확인하기",
    buttonPath: `/workspace/${p.companyId}/employee/claims/${p.claimId}`,
  };
}

export function approvalRejected(p: { companyId: string; claimId: string; title: string; reason: string }): BuiltMessage {
  return {
    template: "APPROVAL_REJECTED",
    text: ["[PocketExpense] 지출결의서가 반려되었습니다. 🔴", `제목: ${p.title}`, `반려 사유: ${p.reason}`].join("\n"),
    buttonLabel: "수정 후 재상신하기",
    buttonPath: `/workspace/${p.companyId}/employee/claims/${p.claimId}/edit`,
  };
}

export function payoutCompleted(p: { companyId: string; title: string; payout: number; paidAt: string }): BuiltMessage {
  return {
    template: "PAYOUT_COMPLETED",
    text: ["[PocketExpense] 사비 정산금이 지급되었습니다. 💰", `항목: ${p.title}`, `지급 금액: ${won(p.payout)} 원`, `지급 일시: ${p.paidAt}`].join("\n"),
    buttonLabel: "나의 정산 타임라인 확인",
    buttonPath: `/workspace/${p.companyId}/employee/settlements`,
  };
}

export function invite(p: { companyName: string; name: string; token: string }): BuiltMessage {
  return {
    template: "INVITE",
    text: `${p.companyName}에서 ${p.name}님을 경비 정산 서비스에 초대했습니다.`,
    buttonLabel: "가입하기",
    buttonPath: `/join/i/${p.token}`,
  };
}

export function reminder(p: { companyId: string; companyName: string; pending: number }): BuiltMessage {
  return {
    template: "REMINDER",
    text: `${p.companyName} 아직 제출하지 않은 지출결의서가 있어요 (작성중·반려 ${p.pending}건). 확인 후 상신해 주세요.`,
    buttonLabel: "제출하러 가기",
    buttonPath: `/workspace/${p.companyId}/employee`,
  };
}

// 수신 번호: 휴대폰 번호만 (members.phone은 숫자만 저장)
export function normalizePhone(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : "****";
}
