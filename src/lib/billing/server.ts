import "server-only";
import { BRAND } from "@/lib/brand";
import { todayKst } from "@/lib/dates";
import { pushToMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionCharge, type SubscriptionCharge } from "./checkout";
import { cardLabel, orderId, parseCharge, TOSS_API, tossAuthHeader, type TossResult } from "./toss-format";

// 정기결제 서버(D-298): 토스페이먼츠 자동결제(빌링). 비밀 키·결제키는 서버에서만, 결제·상태는 DB 함수가 한 트랜잭션에서 기록한다
// 규칙: 실패 0~3일 하루 1번 재시도(막지 않음) · 8일째부터 새 영수증 올리기만 멈춤 · 30일 해지 · 바꾸기·해지는 다음 결제일부터
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type ChargeKind = "first" | "renewal" | "retry";

export function tossReady(): boolean {
  return !!process.env.TOSS_SECRET_KEY && !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
}

async function tossPost(path: string, body: unknown, idempotencyKey?: string): Promise<{ status: number; json: unknown }> {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return { status: 0, json: { code: "NOT_CONFIGURED", message: "결제 설정이 아직 안 됐어요" } };
  try {
    const r = await fetch(`${TOSS_API}${path}`, {
      method: "POST",
      headers: { Authorization: tossAuthHeader(secret), "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  } catch {
    return { status: 503, json: { code: "NETWORK", message: "결제사와 연결하지 못했어요" } };
  }
}

// 카드 등록창 성공 → authKey로 결제키 받기
export async function issueBillingKey(authKey: string, customerKey: string): Promise<{ ok: true; billingKey: string; label: string } | { ok: false; message: string }> {
  const { status, json } = await tossPost("/billing/authorizations/issue", { authKey, customerKey });
  const j = json as { billingKey?: string; card?: { issuerCode?: string; number?: string }; message?: string };
  if (status === 200 && j.billingKey) return { ok: true, billingKey: j.billingKey, label: cardLabel(j.card) };
  return { ok: false, message: (j.message ?? "카드를 등록하지 못했어요").slice(0, 200) };
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
  const send = () => tossPost(`/billing/${encodeURIComponent(info.billing_key!)}`, { customerKey: info.customer_key, amount: c.total, orderId: oid, orderName, taxFreeAmount: 0 }, oid);
  let r = await send();
  let result: TossResult = parseCharge(r.status, r.json, c.total);
  if (!result.ok && result.retryable) {
    r = await send(); // 같은 주문번호(Idempotency-Key)라 두 번 결제되지 않는다
    result = parseCharge(r.status, r.json, c.total);
  }
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
  if (!tossReady()) return { ...out, skipped: "toss keys missing" };
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
