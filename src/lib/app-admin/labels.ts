// 앱관리자 화면 표시용 이름·형식
export const EVIDENCE_LABEL: Record<string, string> = {
  card_slip: "카드매출전표",
  cash_receipt: "현금영수증",
  tax_invoice: "세금계산서",
  simple_receipt: "간이영수증",
  other: "기타",
};

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  draft: "임시저장",
  submitted: "검토 대기",
  approved: "승인 완료",
  rejected: "반려됨",
  paid: "정산 완료",
};

export const PARSE_STATUS_LABEL: Record<string, string> = {
  none: "-",
  parsing: "인식 중",
  success: "인식 완료",
  failed: "인식 실패",
};

export const LEDGER_REASON_LABEL: Record<string, string> = {
  free_trial_grant: "무료 지급",
  event_bonus: "이벤트 추가 지급",
  receipt_upload: "영수증 업로드",
};

export const ROLE_LABEL: Record<string, string> = { super_admin: "최고 관리자", admin: "관리자", employee: "직원" };
export const MEMBER_STATUS_LABEL: Record<string, string> = { approved: "활성", pending: "승인 대기", inactive: "비활성", rejected: "거절" };

// 한국 시간 "YYYY-MM-DD HH:mm"
export function formatKst(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return p.replace("T", " ");
}

export function formatBizNo(n: string | null | undefined): string {
  if (!n || !/^\d{10}$/.test(n)) return n ?? "";
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
}

// CSV 칸 (쉼표·따옴표·줄바꿈 처리, 수식 주입 방지)
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; // 음수(할인 금액)는 숫자로 둔다
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
