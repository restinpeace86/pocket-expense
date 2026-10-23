import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExportRow } from "./export-rows";

// 지출결의서 PDF에 그릴 결의서 문서 데이터 (form-template.md §5, template-configuration.md §2 기본 양식, T10-3b)
// 패키지에 든 결의서마다 결의서 전체 항목(다른 달 항목 포함 — PDF에서 회색)과 결재 단계를 모은다. 관리자 RLS로 읽는다.
export type ClaimDocItem = {
  id: string;
  sort_order: number;
  expense_date: string | null;
  merchant_name: string | null;
  category: ExportRow["category"];
  trip_type: ExportRow["trip_type"];
  purchase_type: ExportRow["purchase_type"];
  payment_method: ExportRow["payment_method"];
  evidence_type: string | null;
  supply_amount: number | null;
  vat_amount: number | null;
  amount: number | null;
  purpose: string | null;
  headcount: number | null;
  attendees: string | null;
  client_name: string | null;
  start_location: string | null;
  end_location: string | null;
  is_round_trip: boolean | null;
  route_one_way_km: number | null;
  company_supported_amount: number | null;
  personal_burden_amount: number | null;
  account_title_name: string | null;
};
export type ClaimDocStep = { step_kind: "review" | "final"; name: string | null; status: string; acted_at: string | null };
export type ClaimDoc = {
  id: string;
  title: string;
  description: string | null;
  exception_memo: string | null;
  is_business_trip: boolean;
  trip_destination: string | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
  trip_purpose: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  self_approved: boolean;
  total_amount: number;
  total_company_supported: number;
  total_personal_burden: number;
  member: { name: string; department: string | null; position: string | null; bank?: { bank_name: string; account_number: string; account_holder: string } | null };
  items: ClaimDocItem[];
  steps: ClaimDocStep[];
};

const ITEM_COLS =
  "id, claim_id, sort_order, expense_date, merchant_name, category, trip_type, purchase_type, payment_method, evidence_type, supply_amount, vat_amount, amount, purpose, headcount, attendees, client_name, start_location, end_location, is_round_trip, route_one_way_km, company_supported_amount, personal_burden_amount, account_title_name";

export async function getClaimDocs(companyId: string, rows: Pick<ExportRow, "claim_id">[]): Promise<ClaimDoc[]> {
  return getClaimDocsByIds(companyId, [...new Set(rows.map((r) => r.claim_id))]);
}

export async function getClaimDocsByIds(companyId: string, ids: string[]): Promise<ClaimDoc[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const claims: Record<string, unknown>[] = [];
  const items: Record<string, unknown>[] = [];
  const steps: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const [c, it, st] = await Promise.all([
      supabase
        .from("expense_claims")
        .select("id, member_id, title, description, exception_memo, is_business_trip, trip_destination, trip_start_date, trip_end_date, trip_purpose, submitted_at, approved_at, self_approved, total_amount, total_company_supported, total_personal_burden, current_round")
        .eq("company_id", companyId)
        .in("id", part),
      supabase.from("expense_items").select(ITEM_COLS).eq("company_id", companyId).in("claim_id", part).order("sort_order"),
      supabase.from("claim_approvals").select("claim_id, round, step_order, step_kind, status, acted_at, acted_by_member_id, approver_member_id").eq("company_id", companyId).in("claim_id", part).order("step_order"),
    ]);
    claims.push(...((c.data ?? []) as Record<string, unknown>[]));
    items.push(...((it.data ?? []) as Record<string, unknown>[]));
    steps.push(...((st.data ?? []) as Record<string, unknown>[]));
  }
  const memberIds = [...new Set([...claims.map((c) => c.member_id as string), ...steps.flatMap((s) => [s.acted_by_member_id as string, s.approver_member_id as string])].filter(Boolean))];
  const { data: members } = memberIds.length
    ? await supabase.from("members").select("id, name, position, department:departments(name)").eq("company_id", companyId).in("id", memberIds)
    : { data: [] };
  const mem = new Map((members ?? []).map((m) => [m.id, m]));
  // 입금 정보(양식에 '입금 정보' 칸이 있을 때 씀, D-118) — 관리자는 같은 회사 직원 계좌를 읽을 수 있다(RLS bank_select)
  const ownerIds = [...new Set(claims.map((c) => c.member_id as string))];
  const { data: banks } = ownerIds.length
    ? await supabase.from("member_bank_accounts").select("member_id, bank_name, account_number, account_holder").eq("company_id", companyId).in("member_id", ownerIds)
    : { data: [] };
  const bank = new Map((banks ?? []).map((b) => [b.member_id, { bank_name: b.bank_name, account_number: b.account_number, account_holder: b.account_holder }]));
  const order = new Map(ids.map((id, i) => [id, i]));
  return claims
    .map((c) => {
      const owner = mem.get(c.member_id as string);
      const round = c.current_round as number;
      return {
        ...(c as unknown as Omit<ClaimDoc, "member" | "items" | "steps">),
        member: { name: owner?.name ?? "", department: (owner?.department as { name: string } | null)?.name ?? null, position: owner?.position ?? null, bank: bank.get(c.member_id as string) ?? null },
        items: items.filter((i) => i.claim_id === c.id) as unknown as ClaimDocItem[],
        steps: steps
          .filter((s) => s.claim_id === c.id && s.round === round)
          .map((s) => ({
            step_kind: s.step_kind as ClaimDocStep["step_kind"],
            name: mem.get((s.acted_by_member_id ?? s.approver_member_id) as string)?.name ?? null,
            status: s.status as string,
            acted_at: (s.acted_at as string | null) ?? null,
          })),
      };
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
