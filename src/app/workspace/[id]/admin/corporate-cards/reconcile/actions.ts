"use server";

import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { reconcile, recurringPeriodKey, recurringReport, type LedgerItem, type ReconcileResult, type RecurringRef } from "@/lib/cards/reconcile";
import { after } from "next/server";
import { sendRecurringReady } from "@/lib/notify/dispatch";
import type { StatementRow } from "@/lib/cards/statement";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { refresh } from "next/cache";
import { issuesFromResult, type IssueStatus } from "@/lib/cards/saved";
import { pushToMembers } from "@/lib/push/server";
import { formatWon } from "@/lib/format";

// 법인카드 사용 내역 대조 (D-111). 관리자만. 올린 카드 내역은 저장하지 않고 이 요청에서만 쓴다.
// 비교 대상: 같은 회사의 영수증(작성 중 포함 — 올리는 중인 것도 "있음"으로 본다), 내역 기간 ±1일.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function reconcileCardStatementAction(rows: StatementRow[]): Promise<{ ok: true; result: ReconcileResult } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const clean = (Array.isArray(rows) ? rows : [])
    .slice(0, 3000)
    .filter((r) => r && DATE.test(r.date) && Number.isInteger(r.amount) && r.amount > 0 && r.amount < 1_000_000_000)
    .map((r) => ({ line: Number(r.line) || 0, date: r.date, merchant: String(r.merchant ?? "").slice(0, 100), amount: r.amount, last4: r.last4 && /^\d{4}$/.test(r.last4) ? r.last4 : null, bizNo: r.bizNo && /^\d{10}$/.test(r.bizNo) ? r.bizNo : null, cancelled: !!r.cancelled }));
  if (!clean.length) return { ok: false, error: "대조할 결제 내역이 없어요. 날짜·금액 열을 확인해 주세요." };
  const dates = clean.map((r) => r.date).sort();
  const shift = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10);
  const supabase = await createClient();
  const [{ data: items, error }, { data: cards }, { data: recurring }, { data: recurringClaims }] = await Promise.all([
    supabase
      .from("expense_items")
      .select("id, claim_id, expense_date, amount, merchant_name, merchant_business_number, payment_method, corporate_card_id, card_last4, evidence_kind, receipt_path, claim:expense_claims!inner(title, status, member_id)")
      .eq("company_id", m.company_id)
      .gte("expense_date", shift(dates[0], -1))
      .lte("expense_date", shift(dates[dates.length - 1], 1))
      .not("amount", "is", null)
      .limit(5000),
    supabase.from("corporate_cards").select("id, last4").eq("company_id", m.company_id),
    supabase.from("recurring_payments").select("id, service_name, merchant_keyword, amount, cycle, billing_day, billing_month, assignee_member_id").eq("company_id", m.company_id).eq("is_active", true).eq("payment_method", "corporate_card"),
    supabase.from("expense_claims").select("recurring_payment_id, recurring_period").eq("company_id", m.company_id).not("recurring_payment_id", "is", null),
  ]);
  if (error) return { ok: false, error: messageForDbError(error) };
  const cardLast4 = new Map((cards ?? []).map((c) => [c.id, c.last4]));
  // 결의서 → 멤버 외래키가 둘(작성자·지급 처리자)이라 이름은 따로 찾는다
  const memberIds = [...new Set((items ?? []).map((i) => (i.claim as unknown as { member_id: string }).member_id))];
  const { data: members } = memberIds.length ? await supabase.from("members").select("id, name").eq("company_id", m.company_id).in("id", memberIds) : { data: [] };
  const names = new Map((members ?? []).map((x) => [x.id, x.name]));
  const ledger: LedgerItem[] = (items ?? []).map((i) => {
    const c = i.claim as unknown as { title: string; status: string; member_id: string };
    return {
      id: i.id,
      claimId: i.claim_id,
      claimTitle: c?.title || "제목 없는 결의서",
      claimStatus: c?.status ?? "",
      memberName: names.get(c?.member_id) ?? "",
      date: i.expense_date ?? "",
      amount: i.amount ?? 0,
      merchant: i.merchant_name ?? "",
      paymentMethod: i.payment_method,
      last4: (i.corporate_card_id ? cardLast4.get(i.corporate_card_id) : null) ?? i.card_last4 ?? null,
      bizNo: (i.merchant_business_number ?? "").replace(/\D/g, "") || null,
      noEvidence: i.evidence_kind === "none" && !i.receipt_path,
    };
  });
  const result = reconcile(clean, ledger);
  // 정기 결제(D-171): 결의서 없는 결제 중 등록된 정기 결제와 맞는 것, 결제일인데 내역에 없는 것
  const assigneeIds = [...new Set((recurring ?? []).map((r) => r.assignee_member_id))];
  const { data: assignees } = assigneeIds.length ? await supabase.from("members").select("id, name").eq("company_id", m.company_id).in("id", assigneeIds) : { data: [] };
  const refs: RecurringRef[] = (recurring ?? []).map((r) => ({
    id: r.id,
    serviceName: r.service_name,
    keyword: r.merchant_keyword,
    amount: r.amount,
    cycle: r.cycle,
    billingDay: r.billing_day,
    billingMonth: r.billing_month,
    assignee: (assignees ?? []).find((a) => a.id === r.assignee_member_id)?.name ?? "",
    claimedPeriods: (recurringClaims ?? []).filter((c) => c.recurring_payment_id === r.id && c.recurring_period).map((c) => recurringPeriodKey(r.cycle, c.recurring_period as string)),
  }));
  if (refs.length) result.recurring = recurringReport(clean, result.missing, refs);
  return { ok: true, result };
}

// ── 대조 결과 저장·건별 처리 (D-154) ──
// 달별로 저장(같은 달은 덮어쓰고 이미 고른 처리는 유지). 카드 내역 파일은 저장하지 않고 맞지 않는 건만 남긴다
export async function saveReconcileAction(month: string, fileName: string, input: ReconcileResult, period: { from: string | null; to: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  // [정기 결제로 처리]로 결의서를 만든 결제는 처리된 것 — 저장할 때 "결의서 없음"에서 뺀다(시나리오 점검 2026-10-29)
  let result = input;
  const rec = input.recurring?.matches ?? [];
  if (rec.length) {
    const { data: claims } = await supabase
      .from("expense_claims")
      .select("recurring_payment_id, recurring_period")
      .eq("company_id", m.company_id)
      .in("recurring_payment_id", [...new Set(rec.map((r) => r.recurringId))]);
    const has = (rid: string, date: string) =>
      (claims ?? []).some((c) => c.recurring_payment_id === rid && !!c.recurring_period && (c.recurring_period.slice(0, 7) === date.slice(0, 7) || (c.recurring_period.slice(5) === "01-01" && c.recurring_period.slice(0, 4) === date.slice(0, 4))));
    result = { ...input, missing: input.missing.filter((row) => !rec.some((r) => r.line === row.line && has(r.recurringId, row.date))) };
  }
  const { error } = await supabase.rpc("save_card_reconciliation", {
    p_month: month,
    p_file_name: fileName.slice(0, 200),
    p_from: period.from as string,
    p_to: period.to as string,
    p_counts: { matched: result.matched.length, personal: result.personal.length, missing: result.missing.length, extra: result.extra.length, cancelled: result.cancelled },
    p_issues: issuesFromResult(result),
  });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

// 건별 처리. '결의서 작성 요청'이면 그 카드 담당 직원에게 알림(웹 푸시, 받기를 켠 경우)
export async function setCardIssueStatusAction(issueId: string, status: IssueStatus, memo: string): Promise<{ ok: true; notified: boolean } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_card_issue_status", { p_issue_id: issueId, p_status: status, p_memo: memo });
  if (error) return { ok: false, error: messageForDbError(error) };
  let notified = false;
  const d = data as { last4: string | null; date: string | null; merchant: string | null; amount: number | null } | null;
  if (status === "claim_requested" && d?.last4) {
    const { data: card } = await supabase.from("corporate_cards").select("holder_member_id").eq("company_id", m.company_id).eq("last4", d.last4).not("holder_member_id", "is", null).limit(1).maybeSingle();
    if (card?.holder_member_id) {
      const r = await pushToMembers(m.company_id, [card.holder_member_id], {
        title: "법인카드 결제 결의서를 올려 주세요",
        body: `${d.date ?? ""} ${d.merchant ?? ""} ${d.amount != null ? formatWon(d.amount) : ""} — 영수증과 결의서가 없어요.`.trim(),
        url: `/workspace/${m.company_id}/employee`,
        tag: `card-issue-${issueId}`,
      });
      notified = r.sent > 0;
    }
  }
  refresh();
  return { ok: true, notified };
}

type CardRow = { date: string; merchant: string; amount: number; last4: string | null };
const cleanRow = (r: CardRow) => ({ date: DATE.test(r?.date) ? r.date : "", merchant: String(r?.merchant ?? "").slice(0, 100), amount: Math.round(Number(r?.amount) || 0), last4: r?.last4 && /^\d{4}$/.test(r.last4) ? r.last4 : null });

// 증빙 없음 영수증 → 이 카드 결제로 증빙 대체 (D-170). 법인카드·같은 금액·마감 전만(DB 함수가 확인)
export async function substituteCardEvidenceAction(itemId: string, row: CardRow): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const r = cleanRow(row);
  if (!r.date || r.amount < 1) return { ok: false, error: messageForDbError({ message: "CARD_ROW_MISMATCH" }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("substitute_card_evidence", { p_item_id: itemId, p_date: r.date, p_merchant: r.merchant, p_amount: r.amount, p_last4: r.last4 as string });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

// 결의서 없는 카드 결제가 정기 결제와 맞음 → 담당자 앞으로 결의서(작성 중), 카드 결제가 증빙 (D-171)
export async function createRecurringFromCardAction(recurringId: string, row: CardRow): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: messageForDbError({ message: "NOT_ALLOWED" }) };
  const r = cleanRow(row);
  if (!r.date || r.amount < 1) return { ok: false, error: messageForDbError({ message: "CARD_ROW_MISMATCH" }) };
  const supabase = await createClient();
  const { data: claimId, error } = await supabase.rpc("create_recurring_claim_from_card", { p_recurring_id: recurringId, p_date: r.date, p_merchant: r.merchant, p_amount: r.amount, p_last4: r.last4 as string });
  if (error) return { ok: false, error: messageForDbError(error) };
  const { data: rec } = await supabase.from("recurring_payments").select("service_name, cycle, assignee_member_id").eq("id", recurringId).maybeSingle();
  if (rec && claimId) {
    const label = rec.cycle === "monthly" ? `${r.date.slice(0, 4)}년 ${Number(r.date.slice(5, 7))}월` : `${r.date.slice(0, 4)}년`;
    after(() => sendRecurringReady([{ claim_id: claimId as string, company_id: m.company_id, member_id: rec.assignee_member_id, service_name: rec.service_name, period_label: label, amount: r.amount, confirmed: true }]));
  }
  refresh();
  return { ok: true };
}
