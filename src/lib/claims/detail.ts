import "server-only";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { createClient } from "@/lib/supabase/server";
import type { ClaimDetail, DetailApproval, DetailItem } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ITEM_COLUMNS =
  "id, sort_order, category, trip_type, purchase_type, payment_method, corporate_card_id, card_last4, evidence_type, expense_date, merchant_name, merchant_business_number, amount, supply_amount, vat_amount, headcount, purpose, attendees, client_name, trip_start_date, trip_end_date, parse_status, receipt_path, receipt_thumb_path, company_supported_amount, personal_burden_amount, applied_meal_limit_per_person, applied_meal_limit_mode, account_title_id, account_title_name, account_title_code, account_title_overridden, closed_month, paid_time, approval_number, merchant_address, line_items, ai_parsed_payload";

// 결의서 상세. 열람 권한은 RLS(본인 / 같은 회사 관리자 이상 / 지정된 사전 검토자)가 건다.
// ownerOnly: 직원 화면에서는 본인 결의서만(관리자가 직원 모드로 봐도 남의 것은 안 보이게)
export async function getClaimDetail(companyId: string, claimId: string, opts: { ownerMemberId?: string } = {}): Promise<ClaimDetail | null> {
  if (!UUID.test(claimId)) return null;
  const supabase = await createClient();
  let cq = supabase
    .from("expense_claims")
    .select(
      "id, member_id, status, title, description, exception_memo, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, item_count, total_amount, total_company_supported, total_personal_burden, settlement_required, self_approved, current_round, rejection_reason, created_at, submitted_at, approved_at, rejected_at, paid_at",
    )
    .eq("id", claimId)
    .eq("company_id", companyId);
  if (opts.ownerMemberId) cq = cq.eq("member_id", opts.ownerMemberId);
  const [claimRes, itemsRes, apprRes, cardsRes, dupRes] = await Promise.all([
    cq.maybeSingle(),
    supabase.from("expense_items").select(ITEM_COLUMNS).eq("claim_id", claimId).eq("company_id", companyId).order("sort_order"),
    supabase.from("claim_approvals").select("id, round, step_order, step_kind, status, approver_member_id, acted_by_member_id, acted_at, comment, flagged_item_ids").eq("claim_id", claimId).order("round").order("step_order"),
    supabase.from("corporate_cards").select("id, nickname, last4").eq("company_id", companyId),
    supabase.rpc("claim_duplicate_receipts", { p_claim_id: claimId }),
  ]);
  const claim = claimRes.data;
  if (!claim) return null;

  const memberIds = [...new Set([claim.member_id, ...(apprRes.data ?? []).flatMap((a) => [a.approver_member_id, a.acted_by_member_id])].filter((x): x is string => !!x))];
  const { data: members } = await supabase.from("members").select("id, name, position, department_id").in("id", memberIds);
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  const ownerRow = (members ?? []).find((m) => m.id === claim.member_id);
  let department: string | null = null;
  if (ownerRow?.department_id) {
    const { data: d } = await supabase.from("departments").select("name").eq("id", ownerRow.department_id).maybeSingle();
    department = d?.name ?? null;
  }

  const rows = itemsRes.data ?? [];
  const urls = await signReceiptUrls(supabase, rows.map((r) => r.receipt_thumb_path));
  const dups = (dupRes.data ?? {}) as Record<string, { mine: unknown[]; others: number }>;
  const items: DetailItem[] = rows.map(({ receipt_thumb_path, ai_parsed_payload, line_items, paid_time, ...r }) => ({
    ...r,
    paid_time: paid_time?.slice(0, 5) ?? null,
    line_items: Array.isArray(line_items) ? (line_items as DetailItem["line_items"]) : [],
    ai: ai_parsed_payload && typeof ai_parsed_payload === "object" ? (ai_parsed_payload as Record<string, unknown>) : null,
    thumbUrl: receipt_thumb_path ? (urls.get(receipt_thumb_path) ?? null) : null,
    isPdf: !!r.receipt_path?.endsWith(".pdf"),
    duplicate: dups[r.id] ? { mine: dups[r.id].mine.length, others: Number(dups[r.id].others) } : null,
  }));

  const approvals: DetailApproval[] = (apprRes.data ?? []).map((a) => ({
    id: a.id,
    round: a.round,
    step_order: a.step_order,
    step_kind: a.step_kind,
    status: a.status,
    approver_member_id: a.approver_member_id,
    approver_name: a.approver_member_id ? (names.get(a.approver_member_id) ?? null) : null,
    acted_by_name: a.acted_by_member_id ? (names.get(a.acted_by_member_id) ?? null) : null,
    acted_at: a.acted_at,
    comment: a.comment,
    flagged_item_ids: a.flagged_item_ids ?? [],
  }));
  const lastRejected = [...approvals].reverse().find((a) => a.status === "rejected");
  return {
    claim,
    owner: { name: ownerRow?.name ?? "", department, position: ownerRow?.position ?? null },
    items,
    approvals,
    cards: cardsRes.data ?? [],
    payout: items.filter((i) => i.payment_method === "personal_card").reduce((s, i) => s + (i.company_supported_amount ?? i.amount ?? 0), 0),
    payback: items.filter((i) => i.payment_method === "corporate_card").reduce((s, i) => s + i.personal_burden_amount, 0),
    flaggedItemIds: claim.status === "rejected" ? (lastRejected?.flagged_item_ids ?? []) : [],
    pendingStep: approvals.find((a) => a.round === claim.current_round && a.status === "pending") ?? null,
  };
}

// 영수증 원본 링크 (상세에서 크게 보기) — 같은 권한 범위(RLS)
export async function signReceiptOriginal(path: string): Promise<string | null> {
  const supabase = await createClient();
  return (await signReceiptUrls(supabase, [path])).get(path) ?? null;
}
