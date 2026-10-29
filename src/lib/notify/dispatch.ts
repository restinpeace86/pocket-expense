import "server-only";
import { formatDateTimeKst } from "@/lib/claims/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSender, siteUrl } from "./sender";
import { approvalCompleted, approvalRejected, approvalRequest, closingNotice, invite, merchantSummary, normalizePhone, payoutCompleted, recurringReady, reminder, type BuiltMessage, type ClosingKind } from "./templates";

// 결재 알림 보내기 (kakao-alimtalk.md §2, notification-rule.md §2).
// - 결재 처리(DB 트랜잭션)가 끝난 뒤에 부른다. 실패해도 결재는 되돌리지 않는다.
// - 서버 액션에서 세션 사용자의 처리가 성공한 뒤에만 부르며, 수신자 조회·기록은 service role로 한다(같은 회사로 한정).
// - 보낼 때마다 notification_logs에 남긴다(관리자 [알림 이력]에서 확인).
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const RETRY_DELAY_MS = 30_000;

async function deliver(admin: Admin, p: { companyId: string; claimId?: string; memberId?: string; invitationId?: string; phone: string | null; message: BuiltMessage }): Promise<boolean> {
  const sender = getSender();
  const to = normalizePhone(p.phone);
  const buttonUrl = `${siteUrl()}${p.message.buttonPath}`;
  const { data: log } = await admin
    .from("notification_logs")
    .insert({
      company_id: p.companyId,
      claim_id: p.claimId ?? null,
      recipient_member_id: p.memberId ?? null,
      invitation_id: p.invitationId ?? null,
      recipient_phone: to ?? (p.phone ?? ""),
      template_code: p.message.template,
      payload: { text: p.message.text, button_label: p.message.buttonLabel, button_url: buttonUrl, ...(p.message.vars ? { vars: p.message.vars } : {}) },
      status: "queued",
      provider: sender.provider,
    })
    .select("id")
    .single();
  if (!log) return false;
  if (!to) {
    await admin.from("notification_logs").update({ status: "failed", error_message: "수신 번호가 없거나 휴대폰 번호 형식이 아닙니다" }).eq("id", log.id);
    return false;
  }
  const message = { to, template: p.message.template, text: p.message.text, buttonLabel: p.message.buttonLabel, buttonUrl, vars: p.message.vars };
  let result = await sender.send(message);
  if (!result.ok && result.retryable) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS)); // 자동 재시도 1회 (§5)
    result = await sender.send(message);
  }
  await admin
    .from("notification_logs")
    .update(result.ok ? { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId } : { status: "failed", error_message: result.error })
    .eq("id", log.id);
  return result.ok;
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
    admin.from("expense_items").select("payment_method, amount, company_supported_amount, merchant_name").eq("claim_id", claimId).order("sort_order"),
  ]);
  let department: string | null = null;
  if (owner?.department_id) department = (await admin.from("departments").select("name").eq("id", owner.department_id).maybeSingle()).data?.name ?? null;
  const rows = items ?? [];
  return {
    claim,
    owner,
    department,
    merchant: merchantSummary(rows.map((i) => i.merchant_name)),
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
    merchant: c.merchant,
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
      return await deliver(admin, { companyId, claimId, memberId: c.owner.id, phone: c.owner.phone, message: approvalCompleted({ companyId, claimId, name: c.owner.name, title: c.claim.title, total: c.claim.total_amount, payout: c.payout, merchant: c.merchant }) });
    }
    if (event === "rejected" && c.claim.status === "rejected") {
      return await deliver(admin, { companyId, claimId, memberId: c.owner.id, phone: c.owner.phone, message: approvalRejected({ companyId, claimId, name: c.owner.name, title: c.claim.title, total: c.claim.total_amount, merchant: c.merchant, reason: c.claim.rejection_reason ?? "" }) });
    }
  } catch (e) {
    console.error("[alimtalk] 알림 처리 실패", e);
  }
}

// 정산 지급 완료 직후: 지급액이 있는 결의서만 (D-047)
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

// 미제출자 독촉 (REMINDER, D-043, notification-rule.md ⑥). 관리자가 누른 직후 바로 보낸다(결과를 화면에 보여 주려고 기다림).
// 대상 확인(작성중·반려가 있는 활성 멤버, 오늘 아직 안 받음)은 부르는 쪽이 DB 함수 reminder_candidates로 먼저 한다.
export async function sendReminders(companyId: string, targets: { memberId: string; openClaims: number }[]): Promise<number> {
  const admin = createAdminClient();
  if (!admin || !targets.length) return 0;
  const [{ data: company }, { data: members }] = await Promise.all([
    admin.from("companies").select("name").eq("id", companyId).single(),
    admin.from("members").select("id, phone").eq("company_id", companyId).eq("status", "approved").in("id", targets.map((t) => t.memberId)),
  ]);
  const phones = new Map((members ?? []).map((m) => [m.id, m.phone]));
  let n = 0;
  for (const t of targets) {
    if (!phones.has(t.memberId)) continue;
    await deliver(admin, { companyId, memberId: t.memberId, phone: phones.get(t.memberId) ?? null, message: reminder({ companyId, companyName: company?.name ?? "", pending: t.openClaims }) });
    n++;
  }
  return n;
}

// 개별 초대 알림톡 (INVITE, D-042, notification-rule.md). 관리자가 만든 초대(같은 회사, 아직 초대 대기)만 보낸다
export async function sendInvite(companyId: string, invitationId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const [{ data: inv }, { data: company }] = await Promise.all([
    admin.from("member_invitations").select("id, name, phone, token, status").eq("id", invitationId).eq("company_id", companyId).maybeSingle(),
    admin.from("companies").select("name").eq("id", companyId).single(),
  ]);
  if (!inv || inv.status !== "invited") return false;
  await deliver(admin, { companyId, invitationId: inv.id, phone: inv.phone, message: invite({ companyName: company?.name ?? "", name: inv.name, token: inv.token }) });
  await admin.from("member_invitations").update({ last_sent_at: new Date().toISOString() }).eq("id", inv.id);
  return true;
}

// 실패한 알림 다시 보내기 (admin-dashboard.md ⑩, T11-4). 같은 회사의 실패 건만. 보낸 내용은 그대로, 받는 번호는 지금 멤버(또는 초대) 번호로.
// 새 기록을 하나 더 남기고 예전 실패 기록은 그대로 둔다(이력).
export async function resendLog(companyId: string, logId: string): Promise<"sent" | "failed" | "not_found"> {
  const admin = createAdminClient();
  if (!admin) return "failed";
  const { data: log } = await admin
    .from("notification_logs")
    .select("id, claim_id, recipient_member_id, invitation_id, recipient_phone, template_code, payload, status")
    .eq("id", logId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!log || log.status !== "failed") return "not_found";
  let phone: string | null = log.recipient_phone;
  if (log.recipient_member_id) {
    const { data: m } = await admin.from("members").select("phone").eq("id", log.recipient_member_id).eq("company_id", companyId).maybeSingle();
    phone = m?.phone ?? phone;
  } else if (log.invitation_id) {
    const { data: inv } = await admin.from("member_invitations").select("phone, status").eq("id", log.invitation_id).eq("company_id", companyId).maybeSingle();
    if (!inv || inv.status !== "invited") return "not_found"; // 이미 가입·취소된 초대는 다시 보내지 않는다
    phone = inv.phone ?? phone;
  }
  const p = (log.payload ?? {}) as { text?: string; button_label?: string; button_url?: string; vars?: Record<string, string> };
  let buttonPath = "/";
  try {
    buttonPath = p.button_url ? new URL(p.button_url).pathname : "/";
  } catch {
    // 잘못된 주소면 첫 화면
  }
  const ok = await deliver(admin, {
    companyId,
    claimId: log.claim_id ?? undefined,
    memberId: log.recipient_member_id ?? undefined,
    invitationId: log.invitation_id ?? undefined,
    phone,
    message: { template: log.template_code as BuiltMessage["template"], text: p.text ?? "", buttonLabel: p.button_label ?? "", buttonPath, vars: p.vars },
  });
  return ok ? "sent" : "failed";
}

// 정기 결제 결의서가 만들어졌다고 담당자에게 (D-110). cron이 generate_recurring_claims() 결과로 부른다
export async function sendRecurringReady(rows: { claim_id: string; company_id: string; member_id: string; service_name: string; period_label: string; amount: number }[]): Promise<number> {
  const admin = createAdminClient();
  if (!admin || !rows.length) return 0;
  const { data: members } = await admin.from("members").select("id, company_id, phone").in("id", [...new Set(rows.map((r) => r.member_id))]);
  const byId = new Map((members ?? []).map((m) => [m.id, m]));
  let n = 0;
  for (const r of rows) {
    const m = byId.get(r.member_id);
    if (!m || m.company_id !== r.company_id) continue; // 같은 회사 담당자만
    await deliver(admin, {
      companyId: r.company_id,
      claimId: r.claim_id,
      memberId: r.member_id,
      phone: m.phone,
      message: recurringReady({ companyId: r.company_id, claimId: r.claim_id, serviceName: r.service_name, periodLabel: r.period_label, amount: r.amount }),
    });
    n++;
  }
  return n;
}

// 월말 마감 알림톡 (D-161). cron이 closing_admin_targets() 결과로 부른다(하루 한 번 거르기는 부르는 쪽 push_logs)
export async function sendClosingNotice(t: { companyId: string; companyName: string; memberId: string; kind: ClosingKind; month: string; cutoff: string; due: string }): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data: m } = await admin.from("members").select("id, phone").eq("id", t.memberId).eq("company_id", t.companyId).maybeSingle();
  if (!m) return false;
  return deliver(admin, { companyId: t.companyId, memberId: m.id, phone: m.phone, message: closingNotice(t) });
}
