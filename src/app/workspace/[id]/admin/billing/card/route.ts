import { connection, NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { chargeCompany, portoneReady, verifyBillingKey } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 포트원(이니시스) 카드 등록창이 끝나면 여기로(D-298 → D-312). PC는 화면이 billingKey를 들고 오고, 휴대폰은 포트원이 ?billingKey=·?code=를 붙여 보낸다.
// 로그인한 그 회사 관리자만. 빌링키는 포트원에 다시 물어 이 구독 것(구매자 ID = customer_key)인지 확인한 뒤 DB(서버만 읽는 표)에 저장하고
// 무료 기간이면 첫 결제 예약, 아니면 바로 결제(밀린 결제 포함) → 요금제 화면으로 돌아가 결과를 보여 준다

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const back = (q: Record<string, string>) => NextResponse.redirect(new URL(`/workspace/${id}/admin/billing?${new URLSearchParams(q)}#subscription`, request.url));
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== id || !isAdminRole(m.role)) return NextResponse.redirect(new URL("/login", request.url));
  const q = request.nextUrl.searchParams;
  const failCode = q.get("code");
  if (failCode) return back({ billing: "card_failed", msg: (q.get("message") ?? "카드 등록을 마치지 못했어요").slice(0, 200) });
  const billingKey = q.get("billingKey") ?? "";
  if (!billingKey || billingKey.length > 200 || !/^[!-~]+$/.test(billingKey)) return back({ billing: "card_failed" });
  const admin = createAdminClient();
  if (!admin || !portoneReady()) return back({ billing: "card_failed" });
  // 이 회사 구독의 구매자 ID가 맞는지(세션으로 확인)
  const supabase = await createClient();
  const { data: state } = await supabase.rpc("billing_state");
  const sub = (state as { subscription?: { customer_key: string; status: string } | null } | null)?.subscription;
  if (!sub) return back({ billing: "card_failed" });
  const issued = await verifyBillingKey(billingKey, sub.customer_key);
  if (!issued.ok) return back({ billing: "card_failed", msg: issued.message });
  const { data: action, error } = await admin.rpc("billing_card_saved", { p_company: id, p_customer_key: sub.customer_key, p_billing_key: billingKey, p_card_label: issued.label });
  if (error) return back({ billing: "card_failed" });
  if (action === "scheduled") return back({ billing: "scheduled" });
  if (action === "saved") return back({ billing: "card_saved" });
  const r = await chargeCompany(admin, id, sub.status === "past_due" ? "retry" : "first");
  return r.ok ? back({ billing: "paid" }) : back({ billing: "pay_failed", msg: r.message });
}
