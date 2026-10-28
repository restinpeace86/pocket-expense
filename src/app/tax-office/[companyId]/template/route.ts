import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MONTH } from "@/lib/tax/closing";
import { getTaxOfficeClients, getTaxOfficeMonth } from "@/lib/tax-office/queries";
import { templateResponse, type TemplateForExport } from "@/lib/tax-office/template-workbook";
import { logTaxExport } from "@/lib/tax/download-log";

// 세무사무소: 고객사 월말 자료를 사무소 결산 양식으로 (D-150). ?id=양식&month=YYYY-MM
export async function GET(request: NextRequest, ctx: RouteContext<"/tax-office/[companyId]/template">) {
  const { companyId } = await ctx.params;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!MONTH.test(month) || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Bad Request", { status: 400 });
  const company = (await getTaxOfficeClients()).find((c) => c.company_id === companyId);
  if (!company) return new NextResponse("Not Found", { status: 404 });
  const supabase = await createClient();
  const { data: tpl, error } = await supabase.rpc("tax_template_for_export", { p_template_id: id, p_company_id: companyId });
  if (error || !tpl) return new NextResponse("Not Found", { status: 404 });
  const data = await getTaxOfficeMonth(companyId, month);
  if (!data) return new NextResponse("Not Found", { status: 404 });
  const t = tpl as unknown as TemplateForExport;
  await logTaxExport(companyId, month, "template", data.rows.length, data.status === "closed", t.name);
  return templateResponse(t, data.rows, month, company.company_name, data.status !== "closed");
}
