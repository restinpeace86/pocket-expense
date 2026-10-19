import "server-only";
import type { Membership } from "@/lib/auth/paths";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { createClient } from "@/lib/supabase/server";
import type { EditorClaim, EditorData, EditorItem } from "./editor-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

const ITEM_COLUMNS =
  "id, sort_order, category, trip_type, purchase_type, payment_method, corporate_card_id, evidence_type, expense_date, merchant_name, merchant_business_number, amount, supply_amount, vat_amount, headcount, purpose, attendees, client_name, trip_start_date, trip_end_date, parse_status, receipt_path, receipt_thumb_path, company_supported_amount, personal_burden_amount, ai_parsed_payload";

function aiFlags(payload: unknown): { aiCardLast4: string | null; aiIncomeDeduction: boolean } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return {
    aiCardLast4: typeof p.card_last4 === "string" && /^\d{4}$/.test(p.card_last4) ? p.card_last4 : null,
    aiIncomeDeduction: p.suggested_evidence_type === "cash_receipt" && p.cash_receipt_income_deduction === true,
  };
}

// 영수증 원본(보관본) 링크 하나 — 항목 화면에서 크게 보기용
export async function signOriginalUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  return (await signReceiptUrls(supabase, [path])).get(path) ?? null;
}

// 편집 화면 데이터: 본인 회사·본인 소명서만 (다른 사람 소명서 id를 넣어도 null → 404)
export async function getMyClaimForEdit(membership: Membership, claimId: string): Promise<EditorData | null> {
  if (!isUuid(claimId)) return null;
  const supabase = await createClient();
  const [claimRes, itemsRes, cardsRes, companyRes, meRes] = await Promise.all([
    supabase
      .from("expense_claims")
      .select("id, status, title, description, default_payment_method, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, item_count, total_amount, total_company_supported, total_personal_burden, rejection_reason")
      .eq("id", claimId)
      .eq("company_id", membership.company_id)
      .eq("member_id", membership.member_id)
      .maybeSingle(),
    supabase.from("expense_items").select(ITEM_COLUMNS).eq("claim_id", claimId).eq("company_id", membership.company_id).order("sort_order"),
    supabase.from("corporate_cards").select("id, nickname, last4").eq("company_id", membership.company_id).eq("is_active", true).order("created_at"),
    supabase.from("companies").select("meal_limit_enabled, meal_limit_per_person, meal_limit_mode").eq("id", membership.company_id).single(),
    supabase.from("members").select("meal_limit_override").eq("id", membership.member_id).single(),
  ]);
  const claim = claimRes.data;
  if (!claim) return null;
  const rows = itemsRes.data ?? [];
  const urls = await signReceiptUrls(supabase, rows.map((r) => r.receipt_thumb_path));
  const items: EditorItem[] = rows.map(({ ai_parsed_payload, receipt_thumb_path, ...r }) => ({
    ...r,
    thumbUrl: receipt_thumb_path ? (urls.get(receipt_thumb_path) ?? null) : null,
    isPdf: !!r.receipt_path?.endsWith(".pdf"),
    aiFilled: ai_parsed_payload !== null,
    ...aiFlags(ai_parsed_payload),
  }));
  const c = companyRes.data;
  return {
    claim: claim as EditorClaim,
    items,
    cards: cardsRes.data ?? [],
    mealPolicy: { enabled: !!c?.meal_limit_enabled, perPerson: c?.meal_limit_per_person ?? 0, mode: c?.meal_limit_mode ?? "split" },
    mealOverride: meRes.data?.meal_limit_override ?? null,
  };
}
