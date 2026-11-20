// 토스페이먼츠 자동결제(빌링) 요청·응답 다듬기(D-298) — 순수 함수(테스트 가능). 비밀 키는 여기서 읽지 않는다
export const TOSS_API = "https://api.tosspayments.com/v1";

export function tossAuthHeader(secretKey: string): string {
  return "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
}

// 카드 표시: "신한 4673-09**-****-***" — 토스가 준 가린 번호만, 그대로 넘는 길이는 자름
const ISSUERS: Record<string, string> = {
  "3K": "기업BC", "46": "광주", "71": "롯데", "30": "산업", "31": "BC", "51": "삼성", "38": "새마을", "41": "신한", "62": "신협", "36": "씨티", "33": "우리", "W1": "우리", "37": "우체국", "39": "저축", "35": "전북", "42": "제주", "15": "카카오뱅크", "3A": "케이뱅크", "24": "토스뱅크", "21": "하나", "61": "현대", "11": "국민", "91": "NH농협", "34": "수협",
};
export function cardLabel(card: { issuerCode?: string | null; number?: string | null } | null | undefined): string {
  if (!card) return "카드";
  const name = (card.issuerCode && ISSUERS[card.issuerCode]) || "카드";
  const num = (card.number ?? "").replace(/[^0-9*]/g, "");
  const masked = num ? num.replace(/(.{4})(?=.)/g, "$1-") : "";
  return `${name}${masked ? ` ${masked}` : ""}`.slice(0, 60);
}

// 주문번호: 토스 규칙(6~64자, 영문·숫자·-_) + 회사·종류·시간으로 겹치지 않게
export function orderId(companyId: string, kind: string, now = Date.now()): string {
  return `dmo-${companyId.replace(/-/g, "").slice(0, 12)}-${kind}-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 64);
}

export type TossResult = { ok: true; paymentKey: string; receiptUrl: string | null; totalAmount: number } | { ok: false; code: string; message: string; retryable: boolean };

// 결제 승인 응답 → 성공/실패. 금액이 요청과 다르면 실패로 본다
export function parseCharge(status: number, body: unknown, expectedTotal: number): TossResult {
  const b = (body ?? {}) as { status?: string; paymentKey?: string; totalAmount?: number; receipt?: { url?: string } | null; code?: string; message?: string };
  if (status >= 200 && status < 300 && b.status === "DONE" && b.paymentKey) {
    if (b.totalAmount !== expectedTotal) return { ok: false, code: "AMOUNT_MISMATCH", message: "결제 금액이 맞지 않아요", retryable: false };
    return { ok: true, paymentKey: b.paymentKey, receiptUrl: b.receipt?.url ?? null, totalAmount: b.totalAmount };
  }
  return { ok: false, code: b.code ?? `HTTP_${status}`, message: (b.message ?? "결제하지 못했어요").slice(0, 300), retryable: status >= 500 || status === 429 };
}
