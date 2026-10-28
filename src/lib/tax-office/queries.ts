import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TaxMonth } from "@/lib/tax/closing";
import type { ExportRow } from "@/lib/tax/export-rows";

// 세무사(외부 열람자) 화면 조회 (D-148). 어느 회사를 볼 수 있는지는 DB 함수가 로그인 계정의 확인된 이메일로 확인한다.
export type TaxOfficeCompany = { company_id: string; company_name: string; business_number: string; office_name: string; agent_name: string; linked_at: string };

export const getMyTaxCompanies = cache(async (): Promise<TaxOfficeCompany[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_tax_agent_companies");
  if (error) return [];
  return (data ?? []) as TaxOfficeCompany[];
});

export async function isTaxAgent(): Promise<boolean> {
  return (await getMyTaxCompanies()).length > 0;
}

export async function getTaxAgentMonth(companyId: string, month: string): Promise<TaxMonth | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_agent_month_export", { p_company_id: companyId, p_month: month });
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

// 영수증 사진 10분 링크. 세무사는 저장소 권한이 없으므로, 연결을 확인한 위 함수가 돌려준 행의 사진만 운영 키로 발급한다(그 회사 폴더만)
export async function signTaxAgentReceipts(companyId: string, rows: ExportRow[]): Promise<Map<string, string>> {
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
