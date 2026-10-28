import "server-only";
import { createClient } from "@/lib/supabase/server";

// 세무 자료 내려받기 기록 (D-153). 권한 확인은 DB 함수가 한다. 기록이 실패해도 내려받기는 막지 않는다
export type TaxExportKind = "preview" | "package" | "office_xlsx" | "office_zip" | "template";

export async function logTaxExport(companyId: string, month: string, kind: TaxExportKind, rowCount: number, closed: boolean, templateName?: string | null) {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_tax_export", {
      p_company_id: companyId,
      p_month: month,
      p_kind: kind,
      p_row_count: rowCount,
      p_template_name: (templateName ?? null) as string,
      p_closed: closed,
    });
  } catch {
    // 기록 실패는 무시(자료 받기가 우선)
  }
}
