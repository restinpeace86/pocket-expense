// 포트원 V2 정기결제(빌링키) 요청·응답 다듬기(D-298 → D-312: 토스 → 포트원·KG이니시스) — 순수 함수(테스트 가능). 비밀 키는 여기서 읽지 않는다
export const PORTONE_API = "https://api.portone.io";

export function portoneAuthHeader(secret: string): string {
  return `PortOne ${secret}`;
}

// 카드 표시: "신한카드 5365-10**-****-***" — 포트원이 준 가린 번호만, 넘치는 길이는 자름
export function cardLabel(card: { name?: string | null; publisher?: string | null; issuer?: string | null; number?: string | null } | null | undefined): string {
  if (!card) return "카드";
  const name = (card.name || card.publisher || card.issuer || "카드").trim().slice(0, 20);
  const num = (card.number ?? "").replace(/[^0-9*]/g, "");
  const masked = num ? num.replace(/(.{4})(?=.)/g, "$1-") : "";
  return `${name}${masked ? ` ${masked}` : ""}`.slice(0, 60);
}

// 결제 번호(paymentId): 이니시스는 영문·숫자만(ASCII) + 회사·종류·시간으로 겹치지 않게. 같은 번호는 두 번 결제되지 않는다
export function orderId(companyId: string, kind: string, now = Date.now()): string {
  return `dmo-${companyId.replace(/-/g, "").slice(0, 12)}-${kind}-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 64);
}

// 카드 등록 번호(issueId): 이니시스 필수, 영문·숫자만
export function issueId(customerKey: string, now = Date.now()): string {
  return `card-${customerKey.replace(/-/g, "").slice(0, 16)}-${now.toString(36)}`.slice(0, 40);
}

// 휴대폰 번호: 숫자만(이니시스 구매자 연락처)
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(0, 15);
}

export type BillingCustomer = { name: string; email: string; phone: string };

// 빌링키 조회 응답 → 우리 구독 것인지(구매자 ID가 같고 발급됨) + 카드 표시 + 결제 때 쓸 구매자 정보
export function parseBillingKeyInfo(
  status: number,
  body: unknown,
  customerKey: string,
): { ok: true; label: string; customer: BillingCustomer } | { ok: false; message: string } {
  const b = (body ?? {}) as {
    status?: string;
    customer?: { id?: string; name?: string; email?: string; phoneNumber?: string };
    methods?: { type?: string; card?: { name?: string; publisher?: string; issuer?: string; number?: string } }[];
    message?: string;
  };
  if (status !== 200 || b.status !== "ISSUED") return { ok: false, message: (b.message ?? "카드를 등록하지 못했어요").slice(0, 200) };
  if (b.customer?.id !== customerKey) return { ok: false, message: "다른 구독의 카드예요" };
  const card = b.methods?.find((m) => m.type === "BillingKeyPaymentMethodCard")?.card ?? b.methods?.[0]?.card;
  return {
    ok: true,
    label: cardLabel(card),
    customer: { name: (b.customer.name ?? "").slice(0, 50), email: (b.customer.email ?? "").slice(0, 100), phone: phoneDigits(b.customer.phoneNumber) },
  };
}

export type ChargeResult = { ok: true; paymentKey: string; receiptUrl: string | null; totalAmount: number } | { ok: false; code: string; message: string; retryable: boolean };

// 빌링키 결제 요청 응답 → 접수/실패. 카드사 거절(PG_PROVIDER)은 다시 보내도 같은 결과라 바로 실패
export function parseChargeRequest(status: number, body: unknown): { ok: true } | { ok: false; code: string; message: string; retryable: boolean } {
  const b = (body ?? {}) as { payment?: { paidAt?: string }; type?: string; message?: string; pgCode?: string; pgMessage?: string };
  if (status >= 200 && status < 300 && b.payment?.paidAt) return { ok: true };
  const code = b.type === "PG_PROVIDER" && b.pgCode ? `PG_${b.pgCode}` : (b.type ?? `HTTP_${status}`);
  const message = (b.type === "PG_PROVIDER" ? b.pgMessage || b.message : b.message) ?? "결제하지 못했어요";
  const retryable = b.type !== "PG_PROVIDER" && b.type !== "ALREADY_PAID" && (status === 0 || status >= 500 || status === 429 || status === 409);
  return { ok: false, code: code.slice(0, 60), message: message.slice(0, 300), retryable };
}

// 결제 조회 응답(서버가 다시 확인) → 결제됨 + 금액이 요청과 같아야 성공
export function parsePayment(status: number, body: unknown, expectedTotal: number): ChargeResult {
  const b = (body ?? {}) as { status?: string; id?: string; transactionId?: string; amount?: { total?: number }; receiptUrl?: string; failure?: { reason?: string; pgCode?: string; pgMessage?: string }; message?: string };
  if (status === 200 && b.status === "PAID" && b.id) {
    if (b.amount?.total !== expectedTotal) return { ok: false, code: "AMOUNT_MISMATCH", message: "결제 금액이 맞지 않아요", retryable: false };
    return { ok: true, paymentKey: (b.transactionId || b.id).slice(0, 200), receiptUrl: b.receiptUrl ?? null, totalAmount: b.amount.total };
  }
  if (status === 200 && b.status === "FAILED") {
    return { ok: false, code: b.failure?.pgCode ? `PG_${b.failure.pgCode}` : "FAILED", message: (b.failure?.pgMessage || b.failure?.reason || "결제하지 못했어요").slice(0, 300), retryable: false };
  }
  return { ok: false, code: `CHECK_${b.status ?? status}`, message: (b.message ?? "결제 결과를 확인하지 못했어요").slice(0, 300), retryable: false };
}
