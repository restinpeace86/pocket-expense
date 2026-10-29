import "server-only";
import { createClient } from "@/lib/supabase/server";

// 세무사무소 자료 요청 목록 (D-169). 볼 수 있는지는 RLS(회사 관리자 / 그 회사를 볼 수 있는 사무소 구성원)
export type TaxRequest = {
  id: string;
  month: string;
  item_id: string | null;
  item_label: string | null;
  body: string;
  requested_by_name: string | null;
  office_name: string | null;
  status: "open" | "answered" | "resolved";
  answer: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

// 아직 해결 안 된 요청(모든 달) + 이 달의 해결된 요청
export async function listTaxRequests(companyId: string, month: string): Promise<TaxRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_office_requests")
    .select("id, month, item_id, item_label, body, requested_by_name, office_name, status, answer, answered_by_name, answered_at, resolved_at, created_at")
    .eq("company_id", companyId)
    .or(`status.neq.resolved,month.eq.${month}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as TaxRequest[];
}
