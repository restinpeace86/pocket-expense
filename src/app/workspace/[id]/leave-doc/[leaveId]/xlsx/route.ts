import { NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { getLeaveDoc } from "@/lib/company-forms/leave-doc";
import { buildDocWorkbook } from "@/lib/doc-convert/xlsx";

// 휴가신청서 엑셀(회사 양식 모양, 8-104 C). 본인 또는 관리자(RLS)
export async function GET(_request: NextRequest, ctx: RouteContext<"/workspace/[id]/leave-doc/[leaveId]/xlsx">) {
  const { id, leaveId } = await ctx.params;
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== id) return new NextResponse("Not Found", { status: 404 });
  const r = await getLeaveDoc(leaveId);
  if (!r) return new NextResponse("Not Found", { status: 404 });
  const buf = await buildDocWorkbook(r.doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leave.xlsx"; filename*=UTF-8''${encodeURIComponent(`${r.fileName}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
