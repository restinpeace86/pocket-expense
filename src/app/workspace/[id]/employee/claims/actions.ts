"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/session";
import { creditEventAmount, creditEventEnabled } from "@/lib/credits";
import { isUuid } from "@/lib/employee/claim";
import type { ClaimHeaderInput, ItemInput } from "@/lib/employee/editor-types";
import { todayKst } from "@/lib/dates";
import { messageForDbError } from "@/lib/errors";
import { archiveCreditedReceipts } from "@/lib/receipts/archive";
import { parseReceiptWithGemini } from "@/lib/receipts/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 소명서 편집(E-02) 서버 액션. 모든 쓰기는 사용자 세션으로 하고 RLS·DB 함수가 "본인 회사·본인 작성 중 소명서"만 허용한다.
// 크레딧 차감(consume_receipt_credit)만 service role로 부르며, 그 전에 세션 사용자·소속을 확인한다(CLAUDE.md 제2장 제4조).
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function approvedMember() {
  const m = await getMembership();
  return m && m.status === "approved" ? m : null;
}

const fail = (code: string): { ok: false; error: string } => ({ ok: false, error: messageForDbError({ message: code }) });
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 헤더 임시저장. 필수 여부는 상신 때 확인한다(임시저장은 빈 칸 허용).
export async function saveClaimHeaderAction(claimId: string, input: ClaimHeaderInput): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(claimId)) return fail("NOT_FOUND");
  const title = input.title.trim();
  const description = input.description.trim();
  const dest = input.tripDestination.trim();
  const purpose = input.tripPurpose.trim();
  if (title.length > 100 || description.length > 1000 || dest.length > 100 || purpose.length > 100) return fail("INVALID_CLAIM_TEXT");
  const start = DATE.test(input.tripStartDate) ? input.tripStartDate : null;
  const end = DATE.test(input.tripEndDate) ? input.tripEndDate : null;
  if (input.isBusinessTrip && start && end && end < start) return fail("INVALID_TRIP_PERIOD");
  if (input.defaultPaymentMethod !== "corporate_card" && input.defaultPaymentMethod !== "personal_card") return fail("NOT_ALLOWED");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_claims")
    .update({
      title,
      description: description || null,
      default_payment_method: input.defaultPaymentMethod,
      is_business_trip: input.isBusinessTrip,
      // 출장을 끄면 출장 정보도 비운다(다시 켜면 새로 입력)
      trip_destination: input.isBusinessTrip ? dest || null : null,
      trip_start_date: input.isBusinessTrip ? start : null,
      trip_end_date: input.isBusinessTrip ? end : null,
      trip_purpose: input.isBusinessTrip ? purpose || null : null,
    })
    .eq("id", claimId)
    .eq("company_id", m.company_id)
    .eq("member_id", m.member_id)
    .select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("NOT_EDITABLE");
  refresh();
  return { ok: true };
}

// 사진 파일을 먼저 지우고(저장소 열람 정책이 항목 행을 기준으로 하므로) 행을 지운다
async function removeReceiptFiles(supabase: Awaited<ReturnType<typeof createClient>>, paths: (string | null)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from("receipts").remove(list);
}

// 본인 작성 중(draft·rejected) 소명서인지 — 보관함으로 옮기기 전에 확인(관리자도 남의 항목을 지울 수 없다)
async function canEditOwnClaim(supabase: Awaited<ReturnType<typeof createClient>>, claimId: string) {
  const m = await approvedMember();
  if (!m) return false;
  const { data } = await supabase
    .from("expense_claims")
    .select("id")
    .eq("id", claimId)
    .eq("member_id", m.member_id)
    .in("status", ["draft", "rejected"])
    .maybeSingle();
  return !!data;
}

export async function deleteDraftClaimAction(claimId: string): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("expense_claims")
    .select("id, status")
    .eq("id", claimId)
    .eq("company_id", m.company_id)
    .eq("member_id", m.member_id)
    .maybeSingle();
  if (!claim) return fail("NOT_FOUND");
  if (claim.status !== "draft") return fail("NOT_EDITABLE");
  const { data: items } = await supabase.from("expense_items").select("id, receipt_path, receipt_thumb_path, credit_charged").eq("claim_id", claimId);
  // 크레딧을 쓴 영수증은 사진을 운영 보관함으로 먼저 옮긴다(D-080). 못 옮기면 지우지 않는다
  if (!(await archiveCreditedReceipts(m.company_id, (items ?? []).filter((i) => i.credit_charged).map((i) => i.id)))) return fail("UNAVAILABLE");
  await removeReceiptFiles(supabase, (items ?? []).flatMap((i) => [i.receipt_path, i.receipt_thumb_path]));
  const { data, error } = await supabase.from("expense_claims").delete().eq("id", claimId).eq("member_id", m.member_id).select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("NOT_EDITABLE");
  redirect(`/workspace/${m.company_id}/employee`);
}

// 영수증 항목 하나 지우기 (업로드 실패 정리에도 쓴다)
export async function deleteItemAction(itemId: string): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("expense_items")
    .select("id, claim_id, receipt_path, receipt_thumb_path, credit_charged")
    .eq("id", itemId)
    .eq("company_id", m.company_id)
    .maybeSingle();
  if (!item) return fail("NOT_FOUND");
  if (!(await canEditOwnClaim(supabase, item.claim_id))) return fail("NOT_EDITABLE");
  if (item.credit_charged && !(await archiveCreditedReceipts(m.company_id, [item.id]))) return fail("UNAVAILABLE");
  await removeReceiptFiles(supabase, [item.receipt_path, item.receipt_thumb_path]);
  const { data, error } = await supabase.from("expense_items").delete().eq("id", itemId).select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("NOT_EDITABLE");
  await supabase.rpc("refresh_claim_totals", { p_claim_id: item.claim_id });
  return { ok: true };
}

// 1) 업로드 시작: 항목을 만들고 저장 경로를 받는다(경로는 서버가 정한다)
export async function startReceiptUploadAction(
  claimId: string,
  file: { isPdf: boolean; thumbExt: "webp" | "jpg" },
): Promise<Result<{ itemId: string; receiptPath: string; thumbPath: string | null }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_receipt_item", { p_claim_id: claimId, p_is_pdf: file.isPdf, p_thumb_ext: file.thumbExt });
  if (error || !data) return { ok: false, error: messageForDbError(error) };
  const d = data as { item_id: string; receipt_path: string; thumb_path: string | null };
  return { ok: true, itemId: d.item_id, receiptPath: d.receipt_path, thumbPath: d.thumb_path };
}

// 2) 업로드 끝: 크레딧 1장 차감(D-046, 이벤트 자동 지급 D-054) → AI 인식 → 빈 칸 채움
export async function finishReceiptUploadAction(
  itemId: string,
): Promise<Result<{ parsed: boolean; bonusGranted: boolean }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  // 본인 회사·본인 작성 중 소명서의 항목인지 세션으로 먼저 확인
  const { data: item } = await supabase
    .from("expense_items")
    .select("id, claim_id, receipt_path, claim:expense_claims!inner(member_id, status, is_business_trip)")
    .eq("id", itemId)
    .eq("company_id", m.company_id)
    .maybeSingle();
  const claim = item?.claim as { member_id: string; status: string; is_business_trip: boolean } | undefined;
  if (!item || !claim || claim.member_id !== m.member_id || !item.receipt_path) return fail("NOT_FOUND");
  if (claim.status !== "draft" && claim.status !== "rejected") return fail("NOT_EDITABLE");

  const admin = createAdminClient();
  if (!admin) return fail("UNAVAILABLE");
  const { data: credit, error: creditError } = await admin.rpc("consume_receipt_credit", {
    p_item_id: itemId,
    p_member_id: m.member_id,
    p_event_enabled: creditEventEnabled(),
    p_event_amount: creditEventAmount(),
  });
  if (creditError) {
    // 크레딧이 없으면 올린 파일·항목을 되돌린다
    await deleteItemAction(itemId);
    return { ok: false, error: messageForDbError(creditError) };
  }
  const bonusGranted = !!(credit as { bonus_granted?: boolean } | null)?.bonus_granted;

  // 보관본(2000px)을 그대로 AI에 보낸다
  let parsed = null;
  const { data: blob } = await supabase.storage.from("receipts").download(item.receipt_path);
  if (blob) {
    parsed = await parseReceiptWithGemini(
      { data: await blob.arrayBuffer(), mimeType: item.receipt_path.endsWith(".pdf") ? "application/pdf" : "image/jpeg" },
      claim.is_business_trip,
    );
  }
  const { error } = await supabase.rpc("apply_receipt_parse", { p_item_id: itemId, p_ok: !!parsed, p_payload: parsed ?? undefined });
  if (error) return { ok: false, error: messageForDbError(error) };
  return { ok: true, parsed: !!parsed, bonusGranted };
}

// 영수증 없이 항목 추가 (§1 보완). 크레딧은 차감하지 않는다(영수증 업로드가 아님)
export async function createManualItemAction(claimId: string): Promise<Result<{ itemId: string }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("expense_claims")
    .select("id, status, is_business_trip, default_payment_method, item_count")
    .eq("id", claimId)
    .eq("company_id", m.company_id)
    .eq("member_id", m.member_id)
    .maybeSingle();
  if (!claim) return fail("NOT_FOUND");
  if (claim.status !== "draft" && claim.status !== "rejected") return fail("NOT_EDITABLE");
  const { data: last } = await supabase.from("expense_items").select("sort_order").eq("claim_id", claimId).order("sort_order", { ascending: false }).limit(1);
  const count = (await supabase.from("expense_items").select("id", { count: "exact", head: true }).eq("claim_id", claimId)).count ?? 0;
  if (count >= 30) return fail("TOO_MANY_ITEMS");
  const { data, error } = await supabase
    .from("expense_items")
    .insert({
      claim_id: claimId,
      company_id: m.company_id,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
      category: claim.is_business_trip ? "trip" : null,
      payment_method: claim.default_payment_method,
      headcount: 1,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: messageForDbError(error) };
  await supabase.rpc("refresh_claim_totals", { p_claim_id: claimId });
  return { ok: true, itemId: data.id };
}

const CATEGORIES = ["meal", "trip", "meeting", "purchase"] as const;
const TRIP_TYPES = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other"] as const; // 자차(own_car)는 T7에서
const PURCHASE_TYPES = ["pantry", "office_supplies", "small_equipment"] as const;
const EVIDENCE_TYPES = ["card_slip", "cash_receipt", "tax_invoice", "simple_receipt", "other"] as const;
const pickOne = <T extends string>(v: string | null, list: readonly T[]): T | null => (v && (list as readonly string[]).includes(v) ? (v as T) : null);
const wonOrNull = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : null);

// 항목 저장 (§3-3). 임시저장이라 빈 칸은 허용하고, 형식·범위만 확인한다. 금액 계산은 서버(refresh_claim_totals)가 다시 한다.
export async function saveItemAction(itemId: string, input: ItemInput): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const category = pickOne(input.category, CATEGORIES);
  const date = DATE.test(input.expenseDate) ? input.expenseDate : null;
  if (date && date > todayKst()) return fail("INVALID_EXPENSE_DATE");
  const bn = input.merchantBusinessNumber.replace(/[^0-9]/g, "");
  if (bn && bn.length !== 10) return fail("INVALID_BUSINESS_NUMBER");
  const texts = [input.merchantName, input.purpose, input.clientName, input.attendees].map((t) => t.trim());
  if (texts[0].length > 100 || texts[1].length > 200 || texts[2].length > 100 || texts[3].length > 200) return fail("INVALID_ITEM_TEXT");
  const headcount = Number.isInteger(input.headcount) && input.headcount >= 1 && input.headcount <= 99 ? input.headcount : null;
  if (headcount === null) return fail("INVALID_HEADCOUNT");
  const lodging = category === "trip" && input.tripType === "lodging";
  const inDate = lodging && DATE.test(input.tripStartDate) ? input.tripStartDate : null;
  const outDate = lodging && DATE.test(input.tripEndDate) ? input.tripEndDate : null;
  if (inDate && outDate && outDate < inDate) return fail("INVALID_TRIP_PERIOD");
  const corporate = input.paymentMethod === "corporate_card";

  const supabase = await createClient();
  const { data: item } = await supabase.from("expense_items").select("claim_id").eq("id", itemId).eq("company_id", m.company_id).maybeSingle();
  if (!item) return fail("NOT_FOUND");
  const { data, error } = await supabase
    .from("expense_items")
    .update({
      category,
      trip_type: category === "trip" ? pickOne(input.tripType, TRIP_TYPES) : null,
      purchase_type: category === "purchase" ? pickOne(input.purchaseType, PURCHASE_TYPES) : null,
      payment_method: corporate ? "corporate_card" : "personal_card",
      corporate_card_id: corporate && input.corporateCardId && isUuid(input.corporateCardId) ? input.corporateCardId : null, // 다른 회사 카드는 복합 FK가 막는다
      evidence_type: pickOne(input.evidenceType, EVIDENCE_TYPES),
      expense_date: date,
      merchant_name: texts[0] || null,
      merchant_business_number: bn || null,
      amount: wonOrNull(input.amount),
      supply_amount: wonOrNull(input.supplyAmount),
      vat_amount: wonOrNull(input.vatAmount),
      headcount,
      purpose: texts[1] || null,
      client_name: category === "meeting" ? texts[2] || null : null,
      attendees: category === "meeting" ? texts[3] || null : null,
      trip_start_date: inDate,
      trip_end_date: outDate,
    })
    .eq("id", itemId)
    .select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("NOT_EDITABLE");
  const totals = await supabase.rpc("refresh_claim_totals", { p_claim_id: item.claim_id });
  if (totals.error) return { ok: false, error: messageForDbError(totals.error) };
  refresh();
  return { ok: true };
}

// AI로 다시 읽기 — 인식이 실패했거나 멈춘 항목. 크레딧은 항목당 한 번만 빠진다(credit_charged)
export async function rereadReceiptAction(itemId: string) {
  const res = await finishReceiptUploadAction(itemId);
  refresh();
  return res;
}
