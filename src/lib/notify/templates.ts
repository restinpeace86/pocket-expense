// 알림톡 템플릿 6종 문구 (spec/screens/notification-rule.md §2 — 문구의 단일 기준). 링크에는 토큰을 넣지 않는다(D-013).
export type TemplateCode = "APPROVAL_REQUEST" | "APPROVAL_COMPLETED" | "APPROVAL_REJECTED" | "PAYOUT_COMPLETED" | "INVITE" | "REMINDER" | "RECURRING_READY";

// vars: 템플릿 변수(#{이름} 등). 실제 발송대행사는 보통 "템플릿 ID + 변수"로 보내므로 드라이버가 그대로 쓴다(O-01). 로그 드라이버는 콘솔에 함께 찍는다.
export type BuiltMessage = { template: TemplateCode; text: string; buttonLabel: string; buttonPath: string; vars?: Record<string, string> };

export const TEMPLATE_LABEL: Record<TemplateCode, string> = {
  APPROVAL_REQUEST: "결재 요청 (직원 → 결재자)",
  APPROVAL_COMPLETED: "결재 승인 완료 (관리자 → 직원)",
  APPROVAL_REJECTED: "결재 반려 (관리자 → 직원)",
  PAYOUT_COMPLETED: "정산 지급 완료",
  INVITE: "개별 초대",
  REMINDER: "미제출 독촉",
  RECURRING_READY: "정기 결제 결의서 준비",
};

const won = (n: number) => n.toLocaleString("ko-KR");

export function paymentSummary(corporate: number, personal: number): string {
  if (corporate && personal) return `법인 ${corporate} · 사비 ${personal}`;
  if (corporate) return "법인카드";
  if (personal) return "사비";
  return "-";
}

// 사용처(가맹점) 요약: 영수증 순서대로 서로 다른 가맹점 — "김밥천국" / "김밥천국 외 2곳"
export function merchantSummary(names: (string | null | undefined)[]): string {
  const uniq = [...new Set(names.map((n) => (n ?? "").trim()).filter(Boolean))];
  if (!uniq.length) return "-";
  return uniq.length === 1 ? uniq[0] : `${uniq[0]} 외 ${uniq.length - 1}곳`;
}

const linesOf = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `${k}: ${v}`);

export function approvalRequest(p: { companyId: string; claimId: string; name: string; department: string | null; title: string; total: number; count: number; corporate: number; personal: number; merchant: string }): BuiltMessage {
  const vars = {
    상신자: `${p.name}${p.department ? ` (${p.department})` : ""}`,
    제목: p.title,
    금액: `${won(p.total)} 원 (영수증 ${p.count}장)`,
    사용처: p.merchant,
    결제수단: paymentSummary(p.corporate, p.personal),
  };
  return {
    template: "APPROVAL_REQUEST",
    text: ["[PocketExpense] 새로운 지출결의서가 상신되었습니다.", ...linesOf(vars)].join("\n"),
    buttonLabel: "결재하러 가기",
    buttonPath: `/workspace/${p.companyId}/approvals/${p.claimId}`,
    vars,
  };
}

export function approvalCompleted(p: { companyId: string; claimId: string; name: string; title: string; total: number; payout: number; merchant: string }): BuiltMessage {
  const vars = {
    신청자: p.name,
    제목: p.title,
    금액: `${won(p.total)} 원`,
    사용처: p.merchant,
    상태: p.payout > 0 ? `사비 ${won(p.payout)}원 지급 대기 중입니다.` : "법인카드 사용 건으로 정상 마감 처리되었습니다.",
  };
  return {
    template: "APPROVAL_COMPLETED",
    text: ["[PocketExpense] 결재가 정상 완료되었습니다. ✅", ...linesOf(vars)].join("\n"),
    buttonLabel: "내 내역 확인하기",
    buttonPath: `/workspace/${p.companyId}/employee/claims/${p.claimId}`,
    vars,
  };
}

// 반려 사유는 반드시 넣는다 — 비어 있으면(옛 데이터) 결의서에서 확인하라고 안내
export function approvalRejected(p: { companyId: string; claimId: string; name: string; title: string; total: number; merchant: string; reason: string }): BuiltMessage {
  const vars = {
    신청자: p.name,
    제목: p.title,
    금액: `${won(p.total)} 원`,
    사용처: p.merchant,
    "반려 사유": p.reason.trim() || "결의서에서 확인해 주세요",
  };
  return {
    template: "APPROVAL_REJECTED",
    text: ["[PocketExpense] 지출결의서가 반려되었습니다. 🔴", ...linesOf(vars)].join("\n"),
    buttonLabel: "수정 후 재상신하기",
    buttonPath: `/workspace/${p.companyId}/employee/claims/${p.claimId}/edit`,
    vars,
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

// 정기 결제 결의서 준비 (D-110): 담당자에게 "증빙 1장만 붙여 상신"
export function recurringReady(p: { companyId: string; claimId: string; serviceName: string; periodLabel: string; amount: number }): BuiltMessage {
  return {
    template: "RECURRING_READY",
    text: `${p.serviceName} ${p.periodLabel} 구독료(${p.amount.toLocaleString("ko-KR")}원) 결의서가 준비됐어요. 결제 내역(인보이스·카드 결제 내역) 1장만 붙여 상신해 주세요.`,
    buttonLabel: "결의서 열기",
    buttonPath: `/workspace/${p.companyId}/employee/claims/${p.claimId}/edit`,
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
