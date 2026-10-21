import { NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { searchPlaces } from "@/lib/maps/kakao";

// 출발지·도착지 자동완성 (trip-expense.md §4.1). 로그인한 승인 멤버만 — 키를 아무나 쓰는 통로가 되지 않게
export async function GET(request: NextRequest) {
  const m = await getMembership();
  if (!m || m.status !== "approved") return NextResponse.json({ places: [] }, { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 50) return NextResponse.json({ places: [] });
  const places = await searchPlaces(q);
  return NextResponse.json({ places }, { headers: { "Cache-Control": "private, max-age=300" } });
}
