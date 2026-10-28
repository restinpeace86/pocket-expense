import { NextResponse, type NextRequest } from "next/server";
import { getTaxOfficeClients } from "@/lib/tax-office/queries";
import { hometaxFileResponse } from "@/lib/hometax/server";

// 세무사무소: 고객사가 올린 홈택스 원본 받기 (D-158). ?id=
export async function GET(request: NextRequest, ctx: RouteContext<"/tax-office/[companyId]/hometax">) {
  const { companyId } = await ctx.params;
  if (!(await getTaxOfficeClients()).some((c) => c.company_id === companyId)) return new NextResponse("Not Found", { status: 404 });
  return hometaxFileResponse(companyId, request.nextUrl.searchParams.get("id") ?? "");
}
