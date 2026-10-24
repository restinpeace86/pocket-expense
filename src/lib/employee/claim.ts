import "server-only";
import type { FuelType } from "@/lib/expense/route";
import { inputFieldsOf, normalizeLayout } from "@/lib/forms/layout";
import { aiCategoryOf } from "@/lib/expense/category-check";
import { deadlineDate, isOverdue, type DeadlinePolicy } from "@/lib/expense/deadline";
import { todayKst } from "@/lib/dates";
import { maskCardNumber } from "@/lib/cards/match";
import type { Membership } from "@/lib/auth/paths";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { createClient } from "@/lib/supabase/server";
import type { CompanyField, EditorClaim, EditorData, EditorItem } from "./editor-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

const ITEM_COLUMNS =
  "id, sort_order, category, trip_type, purchase_type, payment_method, corporate_card_id, evidence_type, expense_date, merchant_name, merchant_business_number, amount, supply_amount, vat_amount, headcount, purpose, attendees, client_name, trip_start_date, trip_end_date, parse_status, receipt_path, receipt_thumb_path, company_supported_amount, personal_burden_amount, ai_parsed_payload, paid_time, approval_number, merchant_address, line_items, start_location, start_lat, start_lng, end_location, end_lat, end_lng, is_round_trip, route_one_way_km, distance_km, distance_source, route_evidence, applied_fuel_rate_per_km, category_mismatch_ack, evidence_kind, no_evidence_reason, applied_fuel_mode, applied_fuel_price, applied_fuel_type";

const EVIDENCE_TYPES = ["card_slip", "cash_receipt", "tax_invoice", "simple_receipt", "other"] as const;

function aiFlags(payload: unknown, parseStatus: string | null): { aiCardMasked: string | null; aiIncomeDeduction: boolean; aiPurpose: string | null; aiEvidence: EditorItem["aiEvidence"] } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return {
    // 서버가 앞 6자리·뒤 4자리 말고는 가려 저장한 번호. 예전 기록은 card_last4만 있다
    aiCardMasked: maskCardNumber(p.card_number_masked ?? p.card_last4),
    aiIncomeDeduction: p.suggested_evidence_type === "cash_receipt" && p.cash_receipt_income_deduction === true,
    aiPurpose: typeof p.suggested_purpose === "string" && p.suggested_purpose.trim() ? p.suggested_purpose.trim().slice(0, 40) : null,
    // 읽기에 성공했거나 실패해 기본값(카드매출전표)이 들어간 항목만 이유를 보여 준다
    aiEvidence:
      parseStatus === "success" || parseStatus === "failed"
        ? {
            suggested: (EVIDENCE_TYPES as readonly string[]).includes(String(p.suggested_evidence_type)) ? (p.suggested_evidence_type as EditorItem["evidence_type"]) : null,
            hasApproval: typeof p.approval_number === "string" && p.approval_number.trim() !== "",
            hasCardNumber: typeof (p.card_number_masked ?? p.card_last4) === "string" && String(p.card_number_masked ?? p.card_last4).trim() !== "",
          }
        : null,
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
  const [claimRes, itemsRes, cardsRes, companyRes, meRes, dupRes, vehiclesRes, formRes, lastRes] = await Promise.all([
    supabase
      .from("expense_claims")
      .select("id, status, title, description, exception_memo, trip_transport, default_payment_method, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, item_count, total_amount, total_company_supported, total_personal_burden, rejection_reason, category, purchase_type, meeting_purpose, client_name, attendees, purchase_purpose, purchase_items, headcount, vehicle_id, recurring_payment_id, header_custom_payload, condolence_target")
      .eq("id", claimId)
      .eq("company_id", membership.company_id)
      .eq("member_id", membership.member_id)
      .maybeSingle(),
    supabase.from("expense_items").select(ITEM_COLUMNS).eq("claim_id", claimId).eq("company_id", membership.company_id).order("sort_order"),
    supabase.from("corporate_cards").select("id, nickname, bin6, last4").eq("company_id", membership.company_id).eq("is_active", true).order("created_at"),
    supabase.from("companies").select("meal_limit_enabled, meal_limit_per_person, meal_limit_mode, fuel_enabled, fuel_rate_per_km, fuel_rate_mode, claim_deadline_type, claim_deadline_days").eq("id", membership.company_id).single(),
    supabase.from("members").select("meal_limit_override, receives_car_allowance, vehicle_number, fuel_type").eq("id", membership.member_id).single(),
    supabase.rpc("claim_duplicate_receipts", { p_claim_id: claimId }),
    supabase.from("company_vehicles").select("id, nickname, plate_number, is_active").eq("company_id", membership.company_id).order("created_at"),
    // 회사 추가 항목(D-120): 지금 쓰는 양식에서 '직원이 작성'인 칸 + 내 지난 결의서 값(미리 채움)
    supabase.from("form_templates").select("schema").eq("company_id", membership.company_id).eq("is_active", true).maybeSingle(),
    supabase.from("expense_claims").select("header_custom_payload").eq("company_id", membership.company_id).eq("member_id", membership.member_id).neq("id", claimId).neq("header_custom_payload", "{}").order("created_at", { ascending: false }).limit(1).maybeSingle(),
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
    ...aiFlags(ai_parsed_payload, r.parse_status),
    aiCategory: aiCategoryOf(ai_parsed_payload),
    overdueDeadline: isOverdue(r.expense_date, deadline, todayKst()) ? deadlineDate(r.expense_date, deadline) : null,
  }));
  const c = companyRes.data;
  const companyFields: CompanyField[] = inputFieldsOf(formRes.data ? normalizeLayout(formRes.data.schema) : null).map((f) => ({ key: f.key, label: f.label, required: !!f.required, options: f.options ?? null }));
  const asStrings = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "string") as [string, string][]) : {};
  return {
    companyFields,
    lastCustom: asStrings(lastRes.data?.header_custom_payload),
    claim: { ...(claim as unknown as EditorClaim), header_custom_payload: asStrings(claim.header_custom_payload) },
    items,
    cards: cardsRes.data ?? [],
    vehicles: (vehiclesRes.data ?? []).filter((v) => v.is_active || v.id === claim.vehicle_id),
    mealPolicy: { enabled: !!c?.meal_limit_enabled, perPerson: c?.meal_limit_per_person ?? 0, mode: c?.meal_limit_mode ?? "split" },
    mealOverride: meRes.data?.meal_limit_override ?? null,
    deadline,
    fuel: {
      enabled: !!c?.fuel_enabled,
      ratePerKm: c?.fuel_rate_per_km ?? 0,
      mode: c?.fuel_rate_mode === "opinet" ? "opinet" : "fixed",
      fuelType: (meRes.data?.fuel_type as FuelType | null) ?? "gasoline",
      blocked: !c?.fuel_enabled ? "disabled" : meRes.data?.receives_car_allowance ? "allowance" : null,
      vehicleNumber: meRes.data?.vehicle_number ?? null,
    },
  };
}
