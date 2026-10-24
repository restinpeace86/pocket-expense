"use server";

import { ALL_CATEGORIES, type ExpenseCategory } from "@/lib/expense/categories";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/session";
import { creditEventAmount, creditEventEnabled } from "@/lib/credits";
import { isUuid } from "@/lib/employee/claim";
import type { ClaimHeaderInput, ItemInput, RoutePlaceInput } from "@/lib/employee/editor-types";
import { todayKst } from "@/lib/dates";
import { messageForDbError } from "@/lib/errors";
import { archiveCreditedReceipts } from "@/lib/receipts/archive";
import { parseReceiptWithGemini } from "@/lib/receipts/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeDistance } from "@/lib/maps/kakao";
import { createClient } from "@/lib/supabase/server";
import { inputFieldsOf, normalizeLayout } from "@/lib/forms/layout";

// 결의서 편집(E-02) 서버 액션. 모든 쓰기는 사용자 세션으로 하고 RLS·DB 함수가 "본인 회사·본인 작성 중 결의서"만 허용한다.
// 크레딧 차감(consume_receipt_credit)만 service role로 부르며, 그 전에 세션 사용자·소속을 확인한다(CLAUDE.md 제2장 제4조).
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function approvedMember() {
  const m = await getMembership();
  return m && m.status === "approved" ? m : null;
}

const fail = (code: string): { ok: false; error: string } => ({ ok: false, error: messageForDbError({ message: code }) });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRANSPORTS: readonly string[] = ["own_car", "public_transport", "company_car"]; // 출장 이동 수단 (D-085, D-106)

// 헤더 임시저장. 필수 여부는 상신 때 확인한다(임시저장은 빈 칸 허용).
export async function saveClaimHeaderAction(claimId: string, input: ClaimHeaderInput): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(claimId)) return fail("NOT_FOUND");
  const title = input.title.trim();
  const description = input.description.trim();
  const memo = input.exceptionMemo.trim();
  const dest = input.tripDestination.trim();
  const purpose = input.tripPurpose.trim();
  if (title.length > 100 || description.length > 1000 || memo.length > 500 || dest.length > 100 || purpose.length > 100) return fail("INVALID_CLAIM_TEXT");
  const start = DATE.test(input.tripStartDate) ? input.tripStartDate : null;
  const end = DATE.test(input.tripEndDate) ? input.tripEndDate : null;
  if (input.isBusinessTrip && start && end && end < start) return fail("INVALID_TRIP_PERIOD");
  if (input.defaultPaymentMethod !== "corporate_card" && input.defaultPaymentMethod !== "personal_card") return fail("NOT_ALLOWED");

  const supabase = await createClient();
  // 회사 추가 항목(D-120): 지금 양식의 '직원이 작성' 칸만, 값은 200자까지, 고를 값이 있으면 그중 하나. 다른 키(옛 양식 값)는 그대로 둔다
  let customPayload: Record<string, string> | undefined;
  if (input.custom && Object.keys(input.custom).length) {
    const [{ data: form }, { data: cur }] = await Promise.all([
      supabase.from("form_templates").select("schema").eq("company_id", m.company_id).eq("is_active", true).maybeSingle(),
      supabase.from("expense_claims").select("header_custom_payload").eq("id", claimId).eq("member_id", m.member_id).maybeSingle(),
    ]);
    const fields = inputFieldsOf(form ? normalizeLayout(form.schema) : null);
    const next: Record<string, string> = { ...((cur?.header_custom_payload as Record<string, string> | null) ?? {}) };
    for (const f of fields) {
      if (!(f.key in input.custom)) continue;
      const v = String(input.custom[f.key] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (v && f.options?.length && !f.options.includes(v)) return { ok: false, error: `${f.label}: 목록에서 골라 주세요.` };
      if (v) next[f.key] = v;
      else delete next[f.key];
    }
    customPayload = next;
  }
  // 결의서 대표 카테고리(D-098): 영수증 반영·재계산까지 DB가 한다. 출장비를 고르면 출장 결의서
  const CATS = ALL_CATEGORIES;
  const PURCHASES = ["pantry", "office_supplies", "small_equipment"] as const;
  const category = (CATS as readonly string[]).includes(input.category ?? "") ? (input.category as ExpenseCategory) : null;
  const isTrip = category ? category === "trip" : input.isBusinessTrip;
  if (category) {
    const headcount = input.headcount == null ? null : Number(input.headcount);
    if (headcount !== null && (!Number.isInteger(headcount) || headcount < 1 || headcount > 99)) return fail("INVALID_HEADCOUNT");
    const { error: catError } = await supabase.rpc("set_claim_category", {
      p_claim_id: claimId,
      p_category: category,
      p_purchase_type: (PURCHASES as readonly string[]).includes(input.purchaseType ?? "") ? (input.purchaseType as (typeof PURCHASES)[number]) : undefined,
      p_meeting_purpose: input.meetingPurpose,
      p_client_name: input.clientName,
      p_attendees: input.attendees,
      p_purchase_purpose: input.purchasePurpose,
      p_purchase_items: input.purchaseItems,
      p_headcount: headcount ?? undefined,
      p_vehicle_id: (category === "company_car" || (category === "trip" && input.tripTransport === "company_car")) && input.vehicleId && isUuid(input.vehicleId) ? input.vehicleId : undefined,
      p_trip_transport: category === "trip" && input.tripTransport && TRANSPORTS.includes(input.tripTransport) ? input.tripTransport : undefined,
      p_condolence_target: category === "condolence" && (input.condolenceTarget === "internal" || input.condolenceTarget === "external") ? input.condolenceTarget : undefined,
    });
    if (catError) return { ok: false, error: messageForDbError(catError) };
  }
  const { data, error } = await supabase
    .from("expense_claims")
    .update({
      title,
      description: description || null,
      exception_memo: memo || null,
      default_payment_method: input.defaultPaymentMethod,
      is_business_trip: isTrip,
      // 출장을 끄면 출장 정보도 비운다(다시 켜면 새로 입력)
      trip_destination: isTrip ? dest || null : null,
      trip_start_date: isTrip ? start : null,
      trip_end_date: isTrip ? end : null,
      trip_purpose: isTrip ? purpose || null : null,
      trip_transport: isTrip && input.tripTransport && TRANSPORTS.includes(input.tripTransport) ? input.tripTransport : null,
      ...(customPayload ? { header_custom_payload: customPayload } : {}),
    })
    .eq("id", claimId)
    .eq("company_id", m.company_id)
    .eq("member_id", m.member_id)
    .select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("NOT_EDITABLE");
  // 출장 기간이 바뀌면 출장 일비 줄을 다시 맞춘다(D-124)
  if (isTrip) await supabase.rpc("refresh_claim_totals", { p_claim_id: claimId });
  refresh();
  return { ok: true };
}

// 사진 파일을 먼저 지우고(저장소 열람 정책이 항목 행을 기준으로 하므로) 행을 지운다
async function removeReceiptFiles(supabase: Awaited<ReturnType<typeof createClient>>, paths: (string | null)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from("receipts").remove(list);
}

// 본인 작성 중(draft·rejected) 결의서인지 — 보관함으로 옮기기 전에 확인(관리자도 남의 항목을 지울 수 없다)
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

// stayOnPage: 홈 목록에서 밀어서 지울 때는 이동하지 않고 결과만 돌려준다
export async function deleteDraftClaimAction(claimId: string, opts: { stayOnPage?: boolean } = {}): Promise<Result> {
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
  if (opts.stayOnPage) {
    refresh();
    return { ok: true };
  }
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
    .select("id, claim_id, receipt_path, receipt_thumb_path, credit_charged, route_card_path")
    .eq("id", itemId)
    .eq("company_id", m.company_id)
    .maybeSingle();
  if (!item) return fail("NOT_FOUND");
  if (!(await canEditOwnClaim(supabase, item.claim_id))) return fail("NOT_EDITABLE");
  if (item.credit_charged && !(await archiveCreditedReceipts(m.company_id, [item.id]))) return fail("UNAVAILABLE");
  await removeReceiptFiles(supabase, [item.receipt_path, item.receipt_thumb_path]);
  // 자차 경로 증빙 이미지는 직원이 지울 수 없는 폴더에 있어 서버가 지운다(권한 확인은 위 canEditOwnClaim)
  if (item.route_card_path) await createAdminClient()?.storage.from("receipts").remove([item.route_card_path]);
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
  // 본인 회사·본인 작성 중 결의서의 항목인지 세션으로 먼저 확인
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

const CATEGORIES = ALL_CATEGORIES;
const TRIP_TYPES = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other", "car_fuel", "car_toll"] as const; // 자차(own_car)는 T7에서
const PURCHASE_TYPES = ["pantry", "office_supplies", "small_equipment"] as const;
const EVIDENCE_TYPES = ["card_slip", "cash_receipt", "tax_invoice", "simple_receipt", "other"] as const;
const EVIDENCE_KINDS = ["receipt", "invoice", "app_history", "card_history", "invitation", "other", "none"] as const;
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
  const { data: item } = await supabase.from("expense_items").select("claim_id, category, trip_type").eq("id", itemId).eq("company_id", m.company_id).maybeSingle();
  if (!item) return fail("NOT_FOUND");
  // 자차 유류비 항목: 경로·거리·금액은 경로 함수만 바꾼다. 여기서는 사용일·적요만
  if (item.category === "trip" && item.trip_type === "own_car") {
    const { data, error } = await supabase.from("expense_items").update({ expense_date: date, purpose: texts[1] || null }).eq("id", itemId).select("id");
    if (error) return { ok: false, error: messageForDbError(error) };
    if (!data?.length) return fail("NOT_EDITABLE");
    refresh();
    return { ok: true };
  }
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
      // 증빙 자료 종류·증빙 없음 사유 (D-108)
      evidence_kind: pickOne(input.evidenceKind, EVIDENCE_KINDS),
      no_evidence_reason: input.evidenceKind === "none" ? input.noEvidenceReason.trim().slice(0, 300) || null : null,
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

// 자차 유류비 항목 만들기 (trip-expense.md §4). 회사 설정·자가운전보조금은 DB가 확인한다
export async function createOwnCarItemAction(claimId: string): Promise<Result<{ itemId: string }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(claimId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_own_car_item", { p_claim_id: claimId });
  if (error || !data) return { ok: false, error: messageForDbError(error ?? { message: "NOT_FOUND" }) };
  refresh();
  return { ok: true, itemId: data };
}

// 자차 항목의 사용일·적요 (경로·거리·금액은 saveOwnCarRouteAction)
export async function saveOwnCarItemAction(itemId: string, input: { expenseDate: string; purpose: string }): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const date = DATE.test(input.expenseDate) ? input.expenseDate : null;
  if (date && date > todayKst()) return fail("INVALID_EXPENSE_DATE");
  const purpose = input.purpose.trim();
  if (purpose.length > 200) return fail("INVALID_ITEM_TEXT");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_items")
    .update({ expense_date: date, purpose: purpose || null })
    .eq("id", itemId)
    .eq("company_id", m.company_id)
    .eq("category", "trip")
    .eq("trip_type", "own_car")
    .select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("NOT_EDITABLE");
  refresh();
  return { ok: true };
}

const place = (p: RoutePlaceInput | null) =>
  p && p.name.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { name: p.name.trim().slice(0, 100), address: p.address?.slice(0, 200) ?? null, lat: p.lat, lng: p.lng } : null;

// 자차 경로 저장 → (직접 입력이 아니면) 서버가 Kakao 길찾기로 편도 거리를 구해 반영한다.
// 직원 권한 확인은 set_own_car_route(본인 작성 중 결의서만)가 먼저 하고, 거리 반영은 서버 전용 함수가 저장된 좌표와 같을 때만 한다.
export async function saveOwnCarRouteAction(
  itemId: string,
  input: { start: RoutePlaceInput | null; end: RoutePlaceInput | null; roundTrip: boolean; manualOneWayKm: number | null },
): Promise<Result<{ autoFailed: boolean }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const start = place(input.start);
  const end = place(input.end);
  const manual = input.manualOneWayKm != null && Number.isFinite(input.manualOneWayKm) ? input.manualOneWayKm : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_own_car_route", {
    p_item_id: itemId,
    p_start: start,
    p_end: end,
    p_round_trip: input.roundTrip,
    p_manual_one_way_km: manual ?? undefined,
  });
  if (error) return { ok: false, error: messageForDbError(error) };
  let autoFailed = false;
  if (manual === null && start && end) {
    const { data: it } = await supabase.from("expense_items").select("distance_km, start_lat, start_lng, end_lat, end_lng").eq("id", itemId).maybeSingle();
    if (it && it.distance_km == null && it.start_lat != null && it.start_lng != null && it.end_lat != null && it.end_lng != null) {
      const route = await routeDistance({ lat: Number(it.start_lat), lng: Number(it.start_lng) }, { lat: Number(it.end_lat), lng: Number(it.end_lng) });
      const admin = createAdminClient();
      const applied =
        route && admin
          ? await admin.rpc("apply_route_distance", {
              p_item_id: itemId,
              p_start_lat: Number(it.start_lat),
              p_start_lng: Number(it.start_lng),
              p_end_lat: Number(it.end_lat),
              p_end_lng: Number(it.end_lng),
              p_one_way_m: route.meters,
              p_duration_s: route.seconds,
            })
          : null;
      autoFailed = !applied || !!applied.error || applied.data !== true;
    }
  }
  refresh();
  return { ok: true, autoFailed };
}

// AI로 다시 읽기 — 인식이 실패했거나 멈춘 항목. 크레딧은 항목당 한 번만 빠진다(credit_charged)
export async function rereadReceiptAction(itemId: string) {
  const res = await finishReceiptUploadAction(itemId);
  refresh();
  return res;
}

// 카테고리가 안 맞아 보이는 영수증: "이 결의서가 맞아요" (D-104)
export async function ackItemCategoryAction(itemId: string): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { error } = await supabase.rpc("ack_item_category", { p_item_id: itemId });
  if (error) return { ok: false, error: messageForDbError(error) };
  refresh();
  return { ok: true };
}

// 카테고리가 안 맞아 보이는 영수증을 AI가 본 종류의 새 결의서(작성 중)로 옮긴다 (D-104).
// 결의서 이동·권한 확인은 DB 함수가, 사진 파일을 새 결의서 폴더로 옮기는 일은 서버(세션 확인 뒤 service role)가 한다.
// 파일 이동이 실패해도 열람은 항목에 적힌 경로 기준이라 사진은 그대로 보인다.
export async function moveItemToNewClaimAction(itemId: string): Promise<Result<{ claimId: string }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_item_to_new_claim", { p_item_id: itemId });
  if (error || !data) return { ok: false, error: messageForDbError(error ?? { message: "NOT_FOUND" }) };
  const r = data as { claim_id: string; receipt_path: string | null; thumb_path: string | null };
  const admin = createAdminClient();
  if (admin) {
    const moved: { receipt_path?: string; receipt_thumb_path?: string } = {};
    for (const [col, path] of [["receipt_path", r.receipt_path], ["receipt_thumb_path", r.thumb_path]] as const) {
      const parts = path?.split("/") ?? [];
      // {회사}/{직원}/{결의서}/{파일} — 내 회사·내 폴더일 때만
      if (!path || parts.length !== 4 || parts[0] !== m.company_id || parts[1] !== m.member_id) continue;
      const next = [parts[0], parts[1], r.claim_id, parts[3]].join("/");
      const { error: mvError } = await admin.storage.from("receipts").move(path, next);
      if (!mvError) moved[col] = next;
    }
    if (moved.receipt_path || moved.receipt_thumb_path) {
      await admin.from("expense_items").update(moved).eq("id", itemId).eq("company_id", m.company_id).eq("claim_id", r.claim_id);
      await admin
        .from("receipt_usage_records")
        .update({ ...(moved.receipt_path ? { receipt_path: moved.receipt_path } : {}), ...(moved.receipt_thumb_path ? { thumb_path: moved.receipt_thumb_path } : {}) })
        .eq("item_id", itemId)
        .eq("company_id", m.company_id);
    }
  }
  refresh();
  return { ok: true, claimId: r.claim_id };
}

// 영수증 없이 추가한 항목에 증빙 자료(사진·PDF) 붙이기 (D-108). 경로는 DB가 정하고, 직원 브라우저가 그 경로에 올린다(AI 인식·크레딧 없음)
export async function attachItemEvidenceAction(itemId: string, file: { isPdf: boolean; thumbExt: "webp" | "jpg" }): Promise<Result<{ receiptPath: string; thumbPath: string | null }>> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attach_item_evidence", { p_item_id: itemId, p_is_pdf: file.isPdf, p_thumb_ext: file.thumbExt });
  if (error || !data) return { ok: false, error: messageForDbError(error ?? { message: "NOT_FOUND" }) };
  const d = data as { receipt_path: string; thumb_path: string | null };
  return { ok: true, receiptPath: d.receipt_path, thumbPath: d.thumb_path };
}

// 붙인 자료 떼기(직원이 붙인 자료만) — 파일을 먼저 지우고(저장소 열람이 항목 행의 경로 기준이라) 행을 비운다
export async function detachItemEvidenceAction(itemId: string, opts: { quiet?: boolean } = {}): Promise<Result> {
  const m = await approvedMember();
  if (!m) return fail("NOT_A_MEMBER");
  if (!isUuid(itemId)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data: item } = await supabase.from("expense_items").select("receipt_path, receipt_thumb_path, parse_status").eq("id", itemId).eq("company_id", m.company_id).maybeSingle();
  if (!item) return fail("NOT_FOUND");
  if (item.parse_status !== "none") return fail("NOT_ALLOWED"); // AI로 읽은 영수증은 영수증 삭제로만
  await removeReceiptFiles(supabase, [item.receipt_path, item.receipt_thumb_path]);
  const { error } = await supabase.rpc("detach_item_evidence", { p_item_id: itemId });
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!opts.quiet) refresh();
  return { ok: true };
}

export async function evidenceUploadedAction(): Promise<void> {
  refresh();
}
