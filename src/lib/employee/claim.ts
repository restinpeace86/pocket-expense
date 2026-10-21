import "server-only";
import { deadlineDate, isOverdue, type DeadlinePolicy } from "@/lib/expense/deadline";
import { todayKst } from "@/lib/dates";
import { maskCardNumber } from "@/lib/cards/match";
import type { Membership } from "@/lib/auth/paths";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { createClient } from "@/lib/supabase/server";
import type { EditorClaim, EditorData, EditorItem } from "./editor-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

const ITEM_COLUMNS =
  "id, sort_order, category, trip_type, purchase_type, payment_method, corporate_card_id, evidence_type, expense_date, merchant_name, merchant_business_number, amount, supply_amount, vat_amount, headcount, purpose, attendees, client_name, trip_start_date, trip_end_date, parse_status, receipt_path, receipt_thumb_path, company_supported_amount, personal_burden_amount, ai_parsed_payload, paid_time, approval_number, merchant_address, line_items, start_location, start_lat, start_lng, end_location, end_lat, end_lng, is_round_trip, route_one_way_km, distance_km, distance_source, route_evidence, applied_fuel_rate_per_km";

function aiFlags(payload: unknown): { aiCardMasked: string | null; aiIncomeDeduction: boolean; aiPurpose: string | null } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return {
    // 서버가 앞 6자리·뒤 4자리 말고는 가려 저장한 번호. 예전 기록은 card_last4만 있다
    aiCardMasked: maskCardNumber(p.card_number_masked ?? p.card_last4),
    aiIncomeDeduction: p.suggested_evidence_type === "cash_receipt" && p.cash_receipt_income_deduction === true,
    aiPurpose: typeof p.suggested_purpose === "string" && p.suggested_purpose.trim() ? p.suggested_purpose.trim().slice(0, 40) : null,
  };
}

// 영수증 원본(보관본) 링크 하나 — 항목 화면에서 크게 보기용
export async function signOriginalUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  return (await signReceiptUrls(supabase, [path])).get(path) ?? null;
}

// 편집 화면 데이터: 본인 회사·본인 결의서만 (다른 사람 결의서 id를 넣어도 null → 404)
export async function getMyClaimForEdit(membership: Membership, claimId: string): Promise<EditorData | null> {
  if (!isUuid(claimId)) return null;
  const supabase = await createClient();
  const [claimRes, itemsRes, cardsRes, companyRes, meRes, dupRes] = await Promise.all([
    supabase
      .from("expense_claims")
      .select("id, status, title, description, exception_memo, trip_transport, default_payment_method, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, item_count, total_amount, total_company_supported, total_personal_burden, rejection_reason")
      .eq("id", claimId)
      .eq("company_id", membership.company_id)
      .eq("member_id", membership.member_id)
      .maybeSingle(),
    supabase.from("expense_items").select(ITEM_COLUMNS).eq("claim_id", claimId).eq("company_id", membership.company_id).order("sort_order"),
    supabase.from("corporate_cards").select("id, nickname, bin6, last4").eq("company_id", membership.company_id).eq("is_active", true).order("created_at"),
    supabase.from("companies").select("meal_limit_enabled, meal_limit_per_person, meal_limit_mode, fuel_enabled, fuel_rate_per_km, claim_deadline_type, claim_deadline_days").eq("id", membership.company_id).single(),
    supabase.from("members").select("meal_limit_override, receives_car_allowance, vehicle_number").eq("id", membership.member_id).single(),
    supabase.rpc("claim_duplicate_receipts", { p_claim_id: claimId }),
  ]);
  const dups = (dupRes.data ?? {}) as Record<string, EditorItem["duplicate"]>;
  const claim = claimRes.data;
  if (!claim) return null;
  const rows = itemsRes.data ?? [];
  const urls = await signReceiptUrls(supabase, rows.map((r) => r.receipt_thumb_path));
  const deadline: DeadlinePolicy = { type: companyRes.data?.claim_deadline_type ?? "none", days: companyRes.data?.claim_deadline_days ?? null };
  const items: EditorItem[] = rows.map(({ ai_parsed_payload, receipt_thumb_path, line_items, paid_time, ...r }) => ({
    ...r,
    paid_time: paid_time?.slice(0, 5) ?? null,
    line_items: Array.isArray(line_items) ? (line_items as EditorItem["line_items"]) : [],
    duplicate: dups[r.id] ?? null,
    thumbUrl: receipt_thumb_path ? (urls.get(receipt_thumb_path) ?? null) : null,
    isPdf: !!r.receipt_path?.endsWith(".pdf"),
    aiFilled: ai_parsed_payload !== null,
    ...aiFlags(ai_parsed_payload),
    overdueDeadline: isOverdue(r.expense_date, deadline, todayKst()) ? deadlineDate(r.expense_date, deadline) : null,
  }));
  const c = companyRes.data;
  return {
    claim: claim as EditorClaim,
    items,
    cards: cardsRes.data ?? [],
    mealPolicy: { enabled: !!c?.meal_limit_enabled, perPerson: c?.meal_limit_per_person ?? 0, mode: c?.meal_limit_mode ?? "split" },
    mealOverride: meRes.data?.meal_limit_override ?? null,
    deadline,
    fuel: {
      enabled: !!c?.fuel_enabled,
      ratePerKm: c?.fuel_rate_per_km ?? 0,
      blocked: !c?.fuel_enabled ? "disabled" : meRes.data?.receives_car_allowance ? "allowance" : null,
      vehicleNumber: meRes.data?.vehicle_number ?? null,
    },
  };
}
