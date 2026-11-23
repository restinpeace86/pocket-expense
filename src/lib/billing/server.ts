import "server-only";
import { BRAND } from "@/lib/brand";
import { todayKst } from "@/lib/dates";
import { pushToMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionCharge, type SubscriptionCharge } from "./checkout";
import { orderId, parseBillingKeyInfo, parseChargeRequest, parsePayment, PORTONE_API, portoneAuthHeader, type BillingCustomer, type ChargeResult } from "./portone-format";

// 정기결제 서버(D-298 → D-312): 포트원 V2 + KG이니시스 정기결제(빌링키). 비밀 키·빌링키는 서버에서만, 결제·상태는 DB 함수가 한 트랜잭션에서 기록한다
// 규칙: 실패 0~3일 하루 1번 재시도(막지 않음) · 8일째부터 새 영수증 올리기만 멈춤 · 30일 해지 · 바꾸기·해지는 다음 결제일부터
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type ChargeKind = "first" | "renewal" | "retry";

export function portoneReady(): boolean {
  return !!process.env.PORTONE_API_SECRET && !!process.env.NEXT_PUBLIC_PORTONE_STORE_ID && !!process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
}

async function portone(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<{ status: number; json: unknown }> {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) return { status: 0, json: { type: "NOT_CONFIGURED", message: "결제 설정이 아직 안 됐어요" } };
  try {
    const r = await fetch(`${PORTONE_API}${path}`, {
      method,
      headers: { Authorization: portoneAuthHeader(secret), "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": `"${idempotencyKey}"` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  } catch {
    return { status: 0, json: { type: "NETWORK", message: "결제사와 연결하지 못했어요" } };
  }
}

// 카드 등록창에서 받은 빌링키가 진짜 이 구독 것인지 포트원에 물어 확인(구매자 ID = customer_key) + 카드 표시·구매자 정보
export async function verifyBillingKey(billingKey: string, customerKey: string): Promise<{ ok: true; label: string; customer: BillingCustomer } | { ok: false; message: string }> {
  const { status, json } = await portone("GET", `/billing-keys/${encodeURIComponent(billingKey)}?storeId=${encodeURIComponent(process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "")}`);
  return parseBillingKeyInfo(status, json, customerKey);
}

// 빌링키로 결제 요청 → 결제 조회로 영수증·거래 번호 확인. 같은 결제 번호(paymentId)는 두 번 결제되지 않는다
async function payWithBillingKey(paymentId: string, billingKey: string, customerKey: string, orderName: string, total: number): Promise<ChargeResult> {
  const info = await verifyBillingKey(billingKey, customerKey); // 이니시스는 결제 때 구매자 이름·이메일·전화가 필요 → 카드 등록 때 넣은 값을 그대로
  if (!info.ok) return { ok: false, code: "BILLING_KEY", message: "등록된 카드를 확인하지 못했어요. 카드를 다시 등록해 주세요.", retryable: false };
  const body = {
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    billingKey,
    orderName,
    customer: { id: customerKey, name: { full: info.customer.name || BRAND.name }, email: info.customer.email || undefined, phoneNumber: info.customer.phone || undefined },
    amount: { total },
    currency: "KRW",
  };
  const send = () => portone("POST", `/payments/${encodeURIComponent(paymentId)}/billing-key`, body, paymentId);
  let r = await send();
  let req = parseChargeRequest(r.status, r.json);
  if (!req.ok && req.retryable) {
    r = await send(); // 같은 결제 번호·Idempotency-Key라 두 번 결제되지 않는다
    req = parseChargeRequest(r.status, r.json);
  }
  if (!req.ok) return req;
  const g = await portone("GET", `/payments/${encodeURIComponent(paymentId)}?storeId=${encodeURIComponent(process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "")}`);
  const paid = parsePayment(g.status, g.json, total);
  if (paid.ok || paid.code === "AMOUNT_MISMATCH") return paid;
  // 결제는 됐는데 조회만 실패 → 결제됨으로 기록(금액은 우리가 보낸 값), 영수증 주소만 없음
  return { ok: true, paymentKey: paymentId, receiptUrl: null, totalAmount: total };
}

type ChargeInfo = {
  company_name: string; status: string; customer_key: string; billing_key: string | null; plan_code: string; plan_name: string; plan_price: number;
  storage_gb: number; storage_price: number; coupon: boolean; exempt: boolean; open: boolean;
};

async function adminIds(admin: Admin, companyId: string): Promise<string[]> {
  const { data } = await admin.from("members").select("id").eq("company_id", companyId).eq("status", "approved").in("role", ["super_admin", "admin"]);
  return (data ?? []).map((m) => m.id);
}

export async function notifyBillingAdmins(admin: Admin, companyId: string, title: string, body: string, tag: string) {
  const ids = await adminIds(admin, companyId);
  if (ids.length) await pushToMembers(companyId, ids, { title, body, url: `/workspace/${companyId}/admin/billing`, tag });
}

export type ChargeOutcome = { ok: true; total: number } | { ok: false; message: string; skipped?: boolean };

// 회사 한 곳 결제: 금액은 DB의 요금제·저장 공간 가격으로 서버에서 계산(화면 값을 믿지 않음)
export async function chargeCompany(admin: Admin, companyId: string, kind: ChargeKind): Promise<ChargeOutcome> {
  const { data } = await admin.rpc("billing_charge_info", { p_company: companyId });
  const info = data as ChargeInfo | null;
  if (!info || !info.billing_key || info.exempt || !info.open) return { ok: false, message: "결제할 수 없는 회사예요", skipped: true };
  const c: SubscriptionCharge = subscriptionCharge(info.plan_price, info.storage_price, info.coupon);
  const oid = orderId(companyId, kind);
  const orderName = `${BRAND.name} ${info.plan_name}${info.storage_gb ? ` + 저장 공간 ${info.storage_gb}GB` : ""} 월 구독`.slice(0, 100);
  const result = await payWithBillingKey(oid, info.billing_key, info.customer_key, orderName, c.total);
  const { error } = await admin.rpc("billing_payment_result", {
    p_company: companyId, p_order_id: oid, p_kind: kind, p_ok: result.ok,
    p_plan: info.plan_code, p_storage: info.storage_gb, p_list: c.list, p_discount: c.discount, p_supply: c.supply, p_vat: c.vat, p_total: c.total, p_coupon: c.coupon,
    p_payment_key: (result.ok ? result.paymentKey : null) as string, p_receipt_url: (result.ok ? result.receiptUrl : null) as string,
    p_fail_code: (result.ok ? null : result.code) as string, p_fail_message: (result.ok ? null : result.message) as string,
  });
  if (error) console.error("billing_payment_result", error.message);
  if (result.ok) return { ok: true, total: c.total };
  // 자동결제(관리자가 화면에 없을 때) 실패만 알림. 처음 결제는 화면에서 바로 보여 준다
  if (kind !== "first") {
    await notifyBillingAdmins(admin, companyId, "요금 결제에 실패했어요", `${result.message}. 요금제 화면에서 카드를 바꾸거나 다시 결제해 주세요. 3일 동안 매일 다시 시도해요.`, "billing-failed");
  }
  return { ok: false, message: result.message };
}

// 매일 아침(cron morning): 매월 1일 장수 → 결제일 결제·재시도 → 해지 예약 → 미납 8일 안내 → 미납 30일 해지
export async function runBilling(): Promise<Record<string, number | string>> {
  const admin = createAdminClient();
  if (!admin) return { error: "no admin" };
  const today = todayKst();
  const out: Record<string, number | string> = { granted: 0, charged: 0, failed: 0, ended: 0, blocked: 0, expired: 0 };
  const { data: granted } = await admin.rpc("billing_monthly_grant", { p_today: today });
  out.granted = granted ?? 0;
  if (!portoneReady()) return { ...out, skipped: "portone keys missing" };
  const { data: due } = await admin.rpc("billing_due", { p_today: today });
  for (const d of (due ?? []) as { company_id: string; action: string }[]) {
    if (d.action === "charge" || d.action === "retry") {
      const r = await chargeCompany(admin, d.company_id, d.action === "charge" ? "renewal" : "retry");
      if (r.ok) (out.charged as number)++;
      else if (!("skipped" in r && r.skipped)) (out.failed as number)++;
    } else if (d.action === "end") {
      await admin.rpc("billing_close", { p_company: d.company_id, p_reason: "user" });
      await notifyBillingAdmins(admin, d.company_id, "구독이 해지됐어요", "신청하신 대로 오늘부터 결제하지 않아요. 지난 자료는 그대로 볼 수 있어요.", "billing-ended");
      (out.ended as number)++;
    } else if (d.action === "block") {
      await notifyBillingAdmins(admin, d.company_id, "결제가 밀려 영수증 올리기가 멈췄어요", "카드를 바꾸거나 다시 결제하면 바로 풀려요. 조회·결재·정산·마감은 그대로 돼요.", "billing-blocked");
      (out.blocked as number)++;
    } else if (d.action === "expire") {
      await admin.rpc("billing_close", { p_company: d.company_id, p_reason: "unpaid" });
      await notifyBillingAdmins(admin, d.company_id, "결제가 30일 밀려 구독이 해지됐어요", "자료는 그대로 볼 수 있어요. 다시 결제하면 영수증 올리기가 풀려요.", "billing-expired");
      (out.expired as number)++;
    }
  }
  return out;
}

// 결제가 밀려(8일째~·미납 해지) 새 영수증 올리기·서류 변환을 멈췄나. 확인이 안 되면 막지 않는다
export async function billingBlocked(companyId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.rpc("billing_upload_blocked", { p_company: companyId });
  return data === true;
}
