import { NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { baseName, validDoc } from "@/lib/doc-convert/model";
import { buildDocWorkbook } from "@/lib/doc-convert/xlsx";
import { createClient } from "@/lib/supabase/server";

// 변환 결과 엑셀 받기(8-104 A-4). 볼 수 있는 변환만(RLS: 만든 사람 또는 회사 공유)
export async function GET(_request: NextRequest, ctx: RouteContext<"/workspace/[id]/employee/convert/[cid]/xlsx">) {
  const { id, cid } = await ctx.params;
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== id || !/^[0-9a-f-]{36}$/.test(cid)) return new NextResponse("Not Found", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("doc_conversions").select("name, sheets").eq("id", cid).maybeSingle();
  if (!data || !validDoc(data.sheets)) return new NextResponse("Not Found", { status: 404 });
  const buf = await buildDocWorkbook(data.sheets);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="convert.xlsx"; filename*=UTF-8''${encodeURIComponent(`${baseName(data.name)}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
