import { NextResponse, type NextRequest } from "next/server";
import { isAdminRole } from "@/lib/auth/paths";
import { getMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { templateResponse, type TemplateForExport } from "@/lib/tax-office/template-workbook";

// 회사 관리자: 우리 세무사무소가 올린 결산 양식으로 세무 마감 자료 받기 (D-150). ?id=양식&month=YYYY-MM
export async function GET(request: NextRequest, ctx: RouteContext<"/workspace/[id]/admin/export/template">) {
  const { id: companyId } = await ctx.params;
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== companyId || !isAdminRole(m.role)) return new NextResponse("Not Found", { status: 404 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!MONTH.test(month) || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Bad Request", { status: 400 });
  const supabase = await createClient();
  const { data: tpl, error } = await supabase.rpc("tax_template_for_export", { p_template_id: id, p_company_id: companyId });
  if (error || !tpl) return new NextResponse("Not Found", { status: 404 });
  const res = await getTaxMonth(month);
  if (!res.ok) return new NextResponse("Not Found", { status: 404 });
  return templateResponse(tpl as unknown as TemplateForExport, res.data.rows, month, m.company_name, res.data.status !== "closed");
}
