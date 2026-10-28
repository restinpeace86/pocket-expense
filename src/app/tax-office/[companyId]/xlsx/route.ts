import { NextResponse, type NextRequest } from "next/server";
import { MONTH } from "@/lib/tax/closing";
import { buildTaxWorkbook } from "@/lib/tax/workbook";
import { getTaxOfficeClients, getTaxOfficeMonth } from "@/lib/tax-office/queries";

// 세무사무소 세무용 엑셀 (D-149): 회사 관리자 세무 마감과 같은 장부. 회사가 마감한 달은 정식 장부, 아니면 '미리보기'
export async function GET(request: NextRequest, ctx: RouteContext<"/tax-office/[companyId]/xlsx">) {
  const { companyId } = await ctx.params;
  const company = (await getTaxOfficeClients()).find((c) => c.company_id === companyId);
  if (!company) return new NextResponse("Not Found", { status: 404 });
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!MONTH.test(month)) return new NextResponse("Bad Request", { status: 400 });
  const data = await getTaxOfficeMonth(companyId, month);
  if (!data) return new NextResponse("Not Found", { status: 404 });
  const preview = data.status !== "closed";
  const buf = await buildTaxWorkbook({ month, companyName: company.company_name, rows: data.rows, preview });
  const [y, mm] = month.split("-");
  const name = `${company.company_name}_${y}년${Number(mm)}월_세무기장용_장부${preview ? "_마감전" : ""}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
