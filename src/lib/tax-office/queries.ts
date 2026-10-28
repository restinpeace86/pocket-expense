import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TaxMonth } from "@/lib/tax/closing";
import type { ExportRow } from "@/lib/tax/export-rows";

// 세무사무소 워크스페이스 조회 (D-149). 어느 회사를 볼 수 있는지는 DB 함수가 사무소 구성원·배정으로 확인한다.
export type TaxOfficeMember = {
  member_id: string;
  office_id: string;
  office_name: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
  name: string;
  invite_code: string | null;
};
export type TaxOfficeRequest = { company_name: string; office_name: string };
export type TaxOfficeState = TaxOfficeMember | { member_id: null; email: string | null; requests: TaxOfficeRequest[] } | null;
export type TaxOfficeClient = {
  company_id: string;
  company_name: string;
  business_number: string;
  agent_name: string | null;
  agent_email: string | null;
  assigned_member_id: string | null;
  assigned_name: string | null;
  linked_at: string;
};

export const getMyTaxOffice = cache(async (): Promise<TaxOfficeState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_tax_office");
  if (error || !data) return null;
  return data as unknown as TaxOfficeState;
});

export const isActiveMember = (s: TaxOfficeState): s is TaxOfficeMember => !!s && s.member_id !== null && (s as TaxOfficeMember).status === "active";

// 로그인 뒤 세무사무소 화면으로 보낼 계정: 사무소 구성원이거나, 내 이메일로 들어온 연결 요청이 있음
export async function isTaxOfficeUser(): Promise<boolean> {
  const s = await getMyTaxOffice();
  if (!s) return false;
  if (s.member_id !== null) return true;
  return s.requests.length > 0;
}

export const getTaxOfficeClients = cache(async (): Promise<TaxOfficeClient[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_office_clients");
  if (error) return [];
  return (data ?? []) as TaxOfficeClient[];
});

export async function getTaxOfficeMonth(companyId: string, month: string): Promise<TaxMonth | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_office_month_export", { p_company_id: companyId, p_month: month });
  if (error || !data) return null;
  const j = data as Record<string, unknown>;
  return {
    month,
    status: j.status === "closed" ? "closed" : "pending",
    closedAt: (j.closed_at as string | null) ?? null,
    reopenedAt: (j.reopened_at as string | null) ?? null,
    reopenReason: (j.reopen_reason as string | null) ?? null,
    rows: (j.rows as ExportRow[]) ?? [],
    excluded: (j.excluded as TaxMonth["excluded"]) ?? { draft: 0, submitted: 0, rejected: 0, claims: 0 },
  };
}

// 영수증 사진 10분 링크. 사무소 구성원은 저장소 권한이 없으므로, 열람을 확인한 위 함수가 돌려준 행의 사진만 운영 키로 발급한다(그 회사 폴더만)
export async function signTaxOfficeReceipts(companyId: string, rows: ExportRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const paths = [...new Set(rows.map((r) => r.receipt_path).filter((p): p is string => !!p && p.startsWith(`${companyId}/`)))];
  const admin = createAdminClient();
  if (!admin || paths.length === 0) return out;
  for (let i = 0; i < paths.length; i += 200) {
    const { data } = await admin.storage.from("receipts").createSignedUrls(paths.slice(i, i + 200), 600);
    for (const row of data ?? []) if (row.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
  }
  return out;
}
