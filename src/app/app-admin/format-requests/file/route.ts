import { NextResponse, type NextRequest } from "next/server";
import { formatFileResponse } from "@/lib/accounting-format/server";
import { getAppAdmin } from "@/lib/app-admin/guard";

// 운영자: 회사가 등록한 회계 양식 원본 받기 (D-180). ?id=
export async function GET(request: NextRequest) {
  const ok = await getAppAdmin();
  if (!ok) return new NextResponse("Not Found", { status: 404 });
  return formatFileResponse(ok.admin, request.nextUrl.searchParams.get("id") ?? "");
}
