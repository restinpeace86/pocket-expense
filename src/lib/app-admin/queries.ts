import "server-only";
import { monthRange } from "@/lib/dates";
import { getAppAdmin, requireAppAdmin } from "./guard";

// 앱관리자 화면 조회 (D-080). 모든 함수가 먼저 운영자 계정을 확인한다(화면 가드와 별도로 한 번 더).
// 영수증 사진 링크는 10분짜리 서명 링크. 지운 영수증은 운영 보관함(receipt-archive) 사진을 쓴다.
export const PHOTO_TTL_SECONDS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCompanyOverview(month: string) {
  const { admin } = await requireAppAdmin();
  const { data, error } = await admin.rpc("app_admin_company_overview", { p_month: month });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type RecordStatus = "in_claim" | "item_deleted";

export async function getCompanyDetail(companyId: string, month: string) {
  if (!UUID.test(companyId)) return null;
  const { admin } = await requireAppAdmin();
  const { start, end } = monthRange(month);
  const [company, members, ledger, records] = await Promise.all([
    admin
      .from("companies")
      .select("id, name, business_number, business_status, created_at, billing_status, receipt_credits_granted, receipt_credits_used, last_event_bonus_at")
      .eq("id", companyId)
      .maybeSingle(),
    admin.from("members").select("id, name, role, status, created_at").eq("company_id", companyId).order("created_at"),
    admin
      .from("credit_ledger")
      .select("id, delta, reason, created_at, member_id, item_id")
      .eq("company_id", companyId)
      .neq("reason", "receipt_upload") // 영수증 차감은 아래 영수증 기록에 한 줄씩 있다
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("receipt_usage_records")
      .select("id, item_id, claim_id, member_name, credited_at, parse_status, ai_parsed_payload, claim_title, claim_status, item_deleted_at, item_snapshot, photo_purge_after, photo_purged_at")
      .eq("company_id", companyId)
      .gte("credited_at", `${start}T00:00:00+09:00`)
      .lt("credited_at", `${end}T00:00:00+09:00`)
      .order("credited_at", { ascending: false })
      .limit(1000),
  ]);
  if (!company.data) return null;
  const rows = records.data ?? [];
  // 지우지 않은 영수증은 지금 값(직원이 고친 값)을 함께 보여 준다
  const liveIds = rows.filter((r) => !r.item_deleted_at).map((r) => r.item_id);
  const live = new Map<string, { merchant_name: string | null; amount: number | null; expense_date: string | null; category: string | null }>();
  for (let i = 0; i < liveIds.length; i += 200) {
    const { data } = await admin.from("expense_items").select("id, merchant_name, amount, expense_date, category").in("id", liveIds.slice(i, i + 200));
    for (const it of data ?? []) live.set(it.id, it);
  }
  const claimIds = [...new Set(rows.filter((r) => !r.item_deleted_at).map((r) => r.claim_id))];
  const claims = new Map<string, { title: string; status: string }>();
  for (let i = 0; i < claimIds.length; i += 200) {
    const { data } = await admin.from("expense_claims").select("id, title, status").in("id", claimIds.slice(i, i + 200));
    for (const c of data ?? []) claims.set(c.id, c);
  }
  return {
    company: company.data,
    members: members.data ?? [],
    ledger: ledger.data ?? [],
    records: rows.map((r) => {
      const now = r.item_deleted_at ? null : live.get(r.item_id);
      const snap = (r.item_snapshot ?? null) as Record<string, unknown> | null;
      const ai = (r.ai_parsed_payload ?? {}) as Record<string, unknown>;
      const claim = r.item_deleted_at ? null : claims.get(r.claim_id);
      return {
        id: r.id,
        credited_at: r.credited_at,
        member_name: r.member_name,
        claim_title: claim?.title ?? r.claim_title,
        claim_status: claim?.status ?? r.claim_status,
        status: (r.item_deleted_at ? "item_deleted" : "in_claim") as RecordStatus,
        item_deleted_at: r.item_deleted_at,
        parse_status: r.parse_status,
        merchant_name: (now?.merchant_name ?? snap?.merchant_name ?? ai.merchant_name ?? null) as string | null,
        amount: (now?.amount ?? snap?.amount ?? ai.amount ?? null) as number | null,
        expense_date: (now?.expense_date ?? snap?.expense_date ?? ai.expense_date ?? null) as string | null,
        line_item_count: Array.isArray(ai.line_items) ? ai.line_items.length : 0,
        photo_state: r.photo_purged_at ? "purged" : r.item_deleted_at ? "archived" : "live",
        photo_purge_after: r.photo_purge_after,
      };
    }),
    truncated: rows.length >= 1000,
  };
}

export async function getReceiptRecord(recordId: string) {
  if (!UUID.test(recordId)) return null;
  const { admin } = await requireAppAdmin();
  const { data: r } = await admin.from("receipt_usage_records").select("*").eq("id", recordId).maybeSingle();
  if (!r) return null;
  const [company, item, claim] = await Promise.all([
    admin.from("companies").select("id, name").eq("id", r.company_id).single(),
    r.item_deleted_at ? Promise.resolve({ data: null }) : admin.from("expense_items").select("*").eq("id", r.item_id).maybeSingle(),
    r.item_deleted_at
      ? Promise.resolve({ data: null })
      : admin.from("expense_claims").select("id, title, status, description, is_business_trip, trip_destination, submitted_at, created_at").eq("id", r.claim_id).maybeSingle(),
  ]);
  // 사진: 살아 있으면 receipts, 지웠으면 운영 보관함, 보관 기간이 지났으면 없음
  let photoUrl: string | null = null;
  let thumbUrl: string | null = null;
  if (!r.photo_purged_at) {
    const bucket = r.item_deleted_at ? "receipt-archive" : "receipts";
    const path = r.item_deleted_at ? r.archived_receipt_path : r.receipt_path;
    const thumb = r.item_deleted_at ? r.archived_thumb_path : r.thumb_path;
    const paths = [path, thumb].filter((p): p is string => !!p);
    if (paths.length) {
      const { data } = await admin.storage.from(bucket).createSignedUrls(paths, PHOTO_TTL_SECONDS);
      for (const s of data ?? []) {
        if (s.path === path) photoUrl = s.signedUrl;
        if (s.path === thumb) thumbUrl = s.signedUrl;
      }
    }
  }
  return { record: r, company: company.data, item: item.data, claim: claim.data, photoUrl, thumbUrl };
}

// CSV 내려받기용: 한 회사·한 달의 영수증 기록 전체 (라우트 핸들러에서 쓰므로 운영자가 아니면 null)
export async function getCompanyRecordsForExport(companyId: string, month: string) {
  if (!UUID.test(companyId)) return null;
  const ok = await getAppAdmin();
  if (!ok) return null;
  const { admin } = ok;
  const { start, end } = monthRange(month);
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("receipt_usage_records")
      .select("*")
      .eq("company_id", companyId)
      .gte("credited_at", `${start}T00:00:00+09:00`)
      .lt("credited_at", `${end}T00:00:00+09:00`)
      .order("credited_at")
      .range(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { data: company } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
  return { companyName: company?.name ?? "", records: out };
}
