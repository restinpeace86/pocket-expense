import { NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { getApprovalDocModel } from "@/lib/approval-docs/server";
import { buildDocWorkbook } from "@/lib/doc-convert/xlsx";

// 결재 문서 엑셀(회사 양식 모양, 9-33e5). 볼 수 있는 사람만(RLS: 쓴 사람·검토자·관리자)
export async function GET(_request: NextRequest, ctx: RouteContext<"/workspace/[id]/approval-doc/[docId]/xlsx">) {
  const { id, docId } = await ctx.params;
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== id) return new NextResponse("Not Found", { status: 404 });
  const r = await getApprovalDocModel(docId);
  if (!r) return new NextResponse("Not Found", { status: 404 });
  const buf = await buildDocWorkbook(r.doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="document.xlsx"; filename*=UTF-8''${encodeURIComponent(`${r.fileName}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
