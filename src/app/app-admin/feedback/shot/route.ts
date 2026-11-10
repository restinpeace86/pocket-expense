import { NextResponse, type NextRequest } from "next/server";
import { getAppAdmin } from "@/lib/app-admin/guard";
import { feedbackShotResponse } from "@/lib/feedback-desk/server";

// 운영자: 버그 신고 캡처 보기 (D-246). ?id=
export async function GET(request: NextRequest) {
  const ok = await getAppAdmin();
  if (!ok) return new NextResponse("Not Found", { status: 404 });
  return feedbackShotResponse(ok.admin, request.nextUrl.searchParams.get("id") ?? "");
}
