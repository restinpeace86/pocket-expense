import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validColumns, type TemplateColumn, type TemplateTarget } from "@/lib/tax-office/template-fields";
import { WEHAGO_DEFAULT, type MainSheet } from "./main-sheet";

// 세무용 엑셀의 회계 프로그램 시트 설정(D-189): 고객사 법인카드 수집 방식 + 사무소가 고른 결산 양식. 권한은 DB 함수(tax_export_options)가 확인.
// 읽지 못하면 기본값(위하고, 법인카드는 홈택스 수집) — 엑셀 받기를 막지 않는다
export type ExportOptions = { cardViaHometax: boolean; officeName: string | null; main: MainSheet };
type Raw = { card_via_hometax?: boolean; office_name?: string | null; main_template?: { id: string; name: string; target: TemplateTarget; columns: TemplateColumn[] } | null };

export async function getExportOptions(companyId: string): Promise<ExportOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_export_options", { p_company_id: companyId });
  if (error || !data) return { cardViaHometax: true, officeName: null, main: WEHAGO_DEFAULT };
  const o = data as unknown as Raw;
  const cardViaHometax = o.card_via_hometax !== false;
  const t = o.main_template;
  const main: MainSheet =
    t && Array.isArray(t.columns) && validColumns(t.columns) ? { kind: "template", name: t.name, target: t.target, columns: t.columns } : { kind: "wehago", includeCorporate: !cardViaHometax };
  return { cardViaHometax, officeName: o.office_name ?? null, main };
}
