// 알림톡 템플릿 6종 문구 (spec/screens/notification-rule.md §2 — 문구의 단일 기준). 링크에는 토큰을 넣지 않는다(D-013).
export type TemplateCode = "APPROVAL_REQUEST" | "APPROVAL_COMPLETED" | "APPROVAL_REJECTED" | "PAYOUT_COMPLETED" | "INVITE" | "REMINDER" | "RECURRING_READY" | "CLOSING" | "TAX_CLOSED" | "TAX_REQUEST" | "TAX_OFFICE_INVITE";

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
  CLOSING: "월말 마감 알림 (관리자)",
  TAX_CLOSED: "고객사 세무 마감 완료 (→ 세무사무소)",
  TAX_REQUEST: "세무사무소 자료 요청 (→ 회사 관리자)",
  TAX_OFFICE_INVITE: "세무사무소 초대 (→ 담당 세무사)",
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
// D-171: 법인카드 정기 결제는 카드 내역으로 결제가 확인됐을 때만 결의서(증빙 = 카드 결제) / 개인카드 정기 결제는 결제일에 올려 달라는 알림만(claimId 없음)
export function recurringReady(p: { companyId: string; claimId: string | null; serviceName: string; periodLabel: string; amount: number }): BuiltMessage {
  const won = p.amount.toLocaleString("ko-KR");
  if (!p.claimId) {
    return {
      template: "RECURRING_READY",
      text: `${p.serviceName} ${p.periodLabel} 구독료(약 ${won}원) 결제일이에요. 개인카드로 결제했다면 결제 내역(영수증·카드 결제 알림)을 찍어 지출결의서를 상신해 주세요.`,
      buttonLabel: "결의서 올리기",
      buttonPath: `/workspace/${p.companyId}/employee`,
    };
  }
  return {
    template: "RECURRING_READY",
    text: `${p.serviceName} ${p.periodLabel} 구독료(${won}원) 카드 결제가 확인돼 결의서를 준비했어요. 카드 결제 내역이 증빙으로 붙어 있으니 확인 후 상신해 주세요.`,
    buttonLabel: "결의서 열기",
    buttonPath: `/workspace/${p.companyId}/employee/claims/${p.claimId}/edit`,
  };
}

// 월말 마감 알림 (D-161, 개선사항 1): 1일 마감 주간 시작 / 3일 홈택스 자료 미업로드 / 5일 세무 마감 당일. 날짜는 영업일로 당긴 날
export type ClosingKind = "week_start" | "hometax_missing" | "close_due";
// pending: 지난달까지 쓴 영수증이 든 승인 대기 결의서 수 — 3일·5일에는 승인·반려 독촉을 앞에 둔다(D-166)
export type ClosingNoticeInput = {
  companyId: string;
  companyName: string;
  kind: ClosingKind;
  month: string;
  cutoff: string;
  due: string;
  pending?: number;
  hometaxMissing?: boolean;
  closed?: boolean;
};
export function closingNotice(p: ClosingNoticeInput): BuiltMessage {
  const m = `${Number(p.month.slice(5, 7))}월`;
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const pending = p.pending ?? 0;
  const nag = p.kind !== "week_start" && pending > 0;
  const parts: string[] = [];
  if (p.kind === "week_start") {
    parts.push(`지출 마감 주간이 시작됐어요. 직원 청구 마감은 ${md(p.cutoff)}, ${m}분 세무 마감은 ${md(p.due)}까지예요. 홈택스에서 ${m} 세금계산서·카드 매입 자료를 내려받아 올려 주세요.`);
    if (pending > 0) parts.push(`승인 대기 결의서 ${pending}건도 마감 전에 승인 또는 반려해 주세요.`);
  } else {
    if (p.kind === "close_due") parts.push(`오늘(${md(p.due)})이 ${m} 지출 세무 마감일이에요.`);
    if (nag) parts.push(`${m}까지 쓴 결의서 ${pending}건이 아직 승인 대기 중이에요. ${p.kind === "close_due" ? "오늘" : `${md(p.due)}`}까지 승인 또는 반려해 주세요. 처리하지 않으면 ${m} 세무 자료에서 빠져요.`);
    if (p.kind === "hometax_missing" && (p.hometaxMissing ?? true)) parts.push(`${m} 홈택스 자료가 아직 올라오지 않았어요. ${md(p.due)}까지 올려 주세요.`);
    if (p.kind === "close_due" && !p.closed) parts.push("누락 내역을 확인하고 마감을 완료해 주세요.");
  }
  return {
    template: "CLOSING",
    text: `[${p.companyName}] ${parts.join(" ")}`,
    buttonLabel: nag ? "승인 대기 보기" : "세무 마감 열기",
    buttonPath: nag ? `/workspace/${p.companyId}/admin/claims?tab=pending` : `/workspace/${p.companyId}/admin/export?month=${p.month}`,
    vars: { kind: p.kind, month: p.month, pending: String(pending) },
  };
}

// 회사가 세무 마감 → 담당 세무사(없으면 사무소 관리자) (D-168)
export function taxClosed(p: { companyId: string; companyName: string; month: string; count: number }): BuiltMessage {
  const m = `${Number(p.month.slice(5, 7))}월`;
  return {
    template: "TAX_CLOSED",
    text: `[PocketExpense] 고객사 ${p.companyName}이(가) ${p.month.slice(0, 4)}년 ${m} 지출을 세무 마감했어요(${p.count.toLocaleString("ko-KR")}건). 장부·영수증·지출결의서·홈택스 자료를 세무사무소 화면에서 받을 수 있어요.`,
    buttonLabel: "세무 자료 보기",
    buttonPath: `/tax-office/${p.companyId}?month=${p.month}`,
    vars: { company: p.companyName, month: p.month, count: String(p.count) },
  };
}

// 세무사무소 → 회사 관리자 자료 요청 (D-169)
export function taxRequest(p: { companyId: string; officeName: string; month: string; body: string; itemLabel?: string | null }): BuiltMessage {
  const m = `${Number(p.month.slice(5, 7))}월`;
  const body = p.body.length > 80 ? `${p.body.slice(0, 80)}…` : p.body;
  return {
    template: "TAX_REQUEST",
    text: `[PocketExpense] ${p.officeName}에서 ${m} 세무 자료를 요청했어요${p.itemLabel ? `(영수증 ${p.itemLabel})` : ""}: "${body}" 세무 마감 화면에서 답변해 주세요.`,
    buttonLabel: "요청 확인하기",
    buttonPath: `/workspace/${p.companyId}/admin/export?month=${p.month}#tax-requests`,
    vars: { office: p.officeName, month: p.month },
  };
}

// 회사가 세무사무소를 지정 → 담당 세무사 휴대폰으로 초대 (D-173). 연결 코드 링크 — 어떤 계정으로 로그인해도 이 고객사와 연결
export function taxOfficeInvite(p: { companyName: string; officeName: string; agentName: string | null; code: string }): BuiltMessage {
  return {
    template: "TAX_OFFICE_INVITE",
    text: `[PocketExpense] ${p.agentName ? `${p.agentName}님, ` : ""}고객사 ${p.companyName}이(가) 지출·증빙 관리에 PocketExpense를 쓰고 있고, ${p.officeName}을(를) 세무대행 사무소로 지정했어요. 무료 세무사무소 워크스페이스에서 승인된 지출 장부·영수증·지출결의서·홈택스 자료를 한 번에 받을 수 있어요.`,
    buttonLabel: "세무사무소로 시작하기",
    buttonPath: `/for-tax-office/${p.code}`,
    vars: { company: p.companyName, office: p.officeName },
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
