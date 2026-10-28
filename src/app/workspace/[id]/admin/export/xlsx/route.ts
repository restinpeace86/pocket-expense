import { NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { getTaxMonth, MONTH } from "@/lib/tax/closing";
import { buildTaxWorkbook } from "@/lib/tax/workbook";
import { logTaxExport } from "@/lib/tax/download-log";

// 세무 마감 엑셀 (tax-export.md §3.1). ?month=YYYY-MM&mode=preview|package
// preview: 마감하지 않는 검토용(파일명 "미리보기") / package: 마감 완료된 달만(ZIP에 넣는 장부)
export async function GET(request: NextRequest, ctx: RouteContext<"/workspace/[id]/admin/export/xlsx">) {
  const { id } = await ctx.params;
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== id || !isAdminRole(m.role)) return new NextResponse("Not Found", { status: 404 });
  const month = request.nextUrl.searchParams.get("month") ?? "";
  const preview = request.nextUrl.searchParams.get("mode") !== "package";
  if (!MONTH.test(month)) return new NextResponse("Bad Request", { status: 400 });
  const res = await getTaxMonth(month);
  if (!res.ok) return new NextResponse("Not Found", { status: 404 });
  if (!preview && res.data.status !== "closed") return new NextResponse("Not closed", { status: 409 });
  const buf = await buildTaxWorkbook({ month, companyName: m.company_name, rows: res.data.rows, preview });
  // 내려받기 기록(D-153): 패키지 장부 = 세무 마감 ZIP을 받을 때
  await logTaxExport(id, month, preview ? "preview" : "package", res.data.rows.length, res.data.status === "closed");
  const [y, mm] = month.split("-");
  const name = preview ? `지출내역_${month}_미리보기.xlsx` : `${y}년${Number(mm)}월_세무기장용_장부.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
