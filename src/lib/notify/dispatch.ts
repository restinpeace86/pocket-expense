import "server-only";
import { formatDateTimeKst } from "@/lib/claims/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSender, siteUrl } from "./sender";
import { approvalCompleted, approvalRejected, approvalRequest, normalizePhone, payoutCompleted, type BuiltMessage } from "./templates";

// 결재 알림 보내기 (kakao-alimtalk.md §2, notification-rule.md §2).
// - 결재 처리(DB 트랜잭션)가 끝난 뒤에 부른다. 실패해도 결재는 되돌리지 않는다.
// - 서버 액션에서 세션 사용자의 처리가 성공한 뒤에만 부르며, 수신자 조회·기록은 service role로 한다(같은 회사로 한정).
// - 보낼 때마다 notification_logs에 남긴다(관리자 [알림 이력]에서 확인).
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const RETRY_DELAY_MS = 30_000;

async function deliver(admin: Admin, p: { companyId: string; claimId?: string; memberId?: string; phone: string | null; message: BuiltMessage }) {
  const sender = getSender();
  const to = normalizePhone(p.phone);
  const buttonUrl = `${siteUrl()}${p.message.buttonPath}`;
  const { data: log } = await admin
    .from("notification_logs")
    .insert({
      company_id: p.companyId,
      claim_id: p.claimId ?? null,
      recipient_member_id: p.memberId ?? null,
      recipient_phone: to ?? (p.phone ?? ""),
      template_code: p.message.template,
      payload: { text: p.message.text, button_label: p.message.buttonLabel, button_url: buttonUrl },
      status: "queued",
      provider: sender.provider,
    })
    .select("id")
    .single();
  if (!log) return;
  if (!to) {
    await admin.from("notification_logs").update({ status: "failed", error_message: "수신 번호가 없거나 휴대폰 번호 형식이 아닙니다" }).eq("id", log.id);
    return;
  }
  const message = { to, template: p.message.template, text: p.message.text, buttonLabel: p.message.buttonLabel, buttonUrl };
  let result = await sender.send(message);
  if (!result.ok && result.retryable) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS)); // 자동 재시도 1회 (§5)
    result = await sender.send(message);
  }
  await admin
    .from("notification_logs")
    .update(result.ok ? { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId } : { status: "failed", error_message: result.error })
    .eq("id", log.id);
}

async function loadClaim(admin: Admin, companyId: string, claimId: string) {
  const { data: claim } = await admin
    .from("expense_claims")
    .select("id, company_id, member_id, title, total_amount, item_count, current_round, status, rejection_reason, self_approved, paid_at")
    .eq("id", claimId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!claim) return null;
  const [{ data: owner }, { data: items }] = await Promise.all([
    admin.from("members").select("id, name, phone, department_id").eq("id", claim.member_id).eq("company_id", companyId).maybeSingle(),
    admin.from("expense_items").select("payment_method, amount, company_supported_amount").eq("claim_id", claimId),
  ]);
  let department: string | null = null;
  if (owner?.department_id) department = (await admin.from("departments").select("name").eq("id", owner.department_id).maybeSingle()).data?.name ?? null;
  const rows = items ?? [];
  return {
    claim,
    owner,
    department,
    corporate: rows.filter((i) => i.payment_method === "corporate_card").length,
    personal: rows.filter((i) => i.payment_method === "personal_card").length,
    payout: rows.filter((i) => i.payment_method === "personal_card").reduce((s, i) => s + (i.company_supported_amount ?? i.amount ?? 0), 0),
  };
}

// 결재 대상자에게 (상신 직후, 사전 검토 승인으로 다음 단계가 됐을 때)
async function sendApprovalRequest(admin: Admin, companyId: string, claimId: string) {
  const c = await loadClaim(admin, companyId, claimId);
  if (!c || c.claim.status !== "submitted" || !c.owner) return;
  const { data: step } = await admin
    .from("claim_approvals")
    .select("step_kind, approver_member_id")
    .eq("claim_id", claimId)
    .eq("round", c.claim.current_round)
    .eq("status", "pending")
    .maybeSingle();
  if (!step) return;
  // 사전 검토 단계: 지정 검토자 / 관리자 승인 단계: 청구자를 뺀 관리자 이상 전원 (D-039)
  const q = admin.from("members").select("id, phone").eq("company_id", companyId).eq("status", "approved");
  const { data: recipients } =
    step.step_kind === "review" && step.approver_member_id ? await q.eq("id", step.approver_member_id) : await q.in("role", ["super_admin", "admin"]).neq("id", c.claim.member_id);
  const message = approvalRequest({
    companyId,
    claimId,
    name: c.owner.name,
    department: c.department,
    title: c.claim.title,
    total: c.claim.total_amount,
    count: c.claim.item_count,
    corporate: c.corporate,
    personal: c.personal,
  });
  for (const r of recipients ?? []) await deliver(admin, { companyId, claimId, memberId: r.id, phone: r.phone, message });
}

export type ClaimEvent = "submitted" | "approved" | "rejected";

// 상신·승인·반려 직후. 최고 관리자 본인 결재 생략 건은 보내지 않는다(expense-lifecycle.md §3-3)
export async function notifyClaimEvent(companyId: string, claimId: string, event: ClaimEvent) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    if (event === "submitted") return await sendApprovalRequest(admin, companyId, claimId);
    const c = await loadClaim(admin, companyId, claimId);
    if (!c || !c.owner || c.claim.self_approved) return;
    if (event === "approved") {
      // 사전 검토 승인 뒤 다음 단계가 남았으면 다음 결재자에게, 최종 승인이면 청구자에게
      if (c.claim.status === "submitted") return await sendApprovalRequest(admin, companyId, claimId);
      if (c.claim.status !== "approved" && c.claim.status !== "paid") return;
      return await deliver(admin, { companyId, claimId, memberId: c.owner.id, phone: c.owner.phone, message: approvalCompleted({ companyId, claimId, title: c.claim.title, total: c.claim.total_amount, payout: c.payout }) });
    }
    if (event === "rejected" && c.claim.status === "rejected") {
      return await deliver(admin, { companyId, claimId, memberId: c.owner.id, phone: c.owner.phone, message: approvalRejected({ companyId, claimId, title: c.claim.title, reason: c.claim.rejection_reason ?? "" }) });
    }
  } catch (e) {
    console.error("[alimtalk] 알림 처리 실패", e);
  }
}

// 정산 지급 완료 직후: 지급액이 있는 소명서만 (D-047)
export async function notifyPayouts(companyId: string, claimIds: string[]) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    for (const claimId of claimIds) {
      const c = await loadClaim(admin, companyId, claimId);
      if (!c || !c.owner || c.claim.status !== "paid" || c.payout <= 0) continue;
      await deliver(admin, {
        companyId,
        claimId,
        memberId: c.owner.id,
        phone: c.owner.phone,
        message: payoutCompleted({ companyId, title: c.claim.title, payout: c.payout, paidAt: formatDateTimeKst(c.claim.paid_at) }),
      });
    }
  } catch (e) {
    console.error("[alimtalk] 지급 알림 처리 실패", e);
  }
}
