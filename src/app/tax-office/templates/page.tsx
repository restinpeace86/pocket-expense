import { Suspense } from "react";
import { DefaultWorkbookInfo } from "@/components/tax-office/default-workbook-info";
import { MainTemplatePicker } from "@/components/tax-office/export-settings";
import { TemplateManager, type OfficeTemplate } from "@/components/tax-office/template-manager";
import { SAMPLE_EXPORT_ROWS } from "@/lib/tax/sample-rows";
import { taxWorkbookLayout, taxWorkbookPreview, WEHAGO_DEFAULT, type MainSheet } from "@/lib/tax/workbook";
import { validColumns } from "@/lib/tax-office/template-fields";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, isActiveMember } from "@/lib/tax-office/queries";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `결산 양식 · ${BRAND.name} 세무사무소` };

// 월말 결산 양식 (D-150): 사무소 회계 프로그램의 엑셀 양식을 올리면 고객사 자료를 그 양식대로 채워 받는다.
// 맨 위 "지금 고객사에 나가는 양식"(D-185·D-186) + 고객사 엑셀에 넣을 회계 프로그램 시트 고르기(D-189)
export default function TaxOfficeTemplatesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const state = await getMyTaxOffice();
  if (!isActiveMember(state)) return null;
  const supabase = await createClient();
  const [{ data }, { data: mainId }] = await Promise.all([supabase.rpc("tax_office_template_list"), supabase.rpc("tax_office_main_template_id")]);
  const templates = (data ?? []) as OfficeTemplate[];
  const picked = templates.find((t) => t.id === mainId);
  const main: MainSheet = picked && validColumns(picked.columns) ? { kind: "template", name: picked.name, target: picked.target, columns: picked.columns } : WEHAGO_DEFAULT;
  const preview = await taxWorkbookPreview({ month: "2026-10", companyName: "예시회사", rows: SAMPLE_EXPORT_ROWS, preview: false, cardReconcile: null, main });
  const notes = new Map(taxWorkbookLayout(main).map((s) => [s.sheet, s.note]));
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">월말 결산 양식</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">
          고객사 세무용 엑셀에는 기본으로 더존 위하고 일반전표 시트가 들어가요. 다른 회계 프로그램(세무사랑·이카운트 등)을 쓰시면 그 프로그램의 엑셀 업로드 양식을 한 번 올리고 아래에서 고르세요. 그러면 위하고 시트 대신 그 양식대로 채워 드려요. 고객사 관리자가 세무 마감 화면에서 받는 엑셀도 같아요.
        </p>
      </div>
      <DefaultWorkbookInfo
        sheets={preview.map((p) => ({ ...p, note: notes.get(p.sheet) ?? "" }))}
        mainName={main.kind === "template" ? main.name : null}
        picker={
          state.role === "admin" ? (
            <MainTemplatePicker key={mainId ?? "wehago"} templates={templates.map((t) => ({ id: t.id, name: t.name, draft: !t.file_name }))} value={picked ? picked.id : null} />
          ) : null
        }
      />
      <TemplateManager templates={templates} canEdit={state.role === "admin"} />
    </>
  );
}
