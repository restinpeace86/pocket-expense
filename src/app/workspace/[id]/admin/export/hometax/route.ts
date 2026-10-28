import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { hometaxFileResponse } from "@/lib/hometax/server";

// 회사 관리자: 올린 홈택스 원본 받기 (D-158). ?id=
export async function GET(request: NextRequest, ctx: RouteContext<"/workspace/[id]/admin/export/hometax">) {
  const { id } = await ctx.params;
  const membership = await requireWorkspace(id, { admin: true });
  const fileId = request.nextUrl.searchParams.get("id") ?? "";
  if (!fileId) return new NextResponse("Bad Request", { status: 400 });
  return hometaxFileResponse(membership.company_id, fileId);
}
