import { NextResponse, type NextRequest } from "next/server";
import { destinationAfterLogin, type Membership } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

// OAuth 콜백: 코드 → 세션 교환 후 소속 상태에 따라 이동 (spec/common/routes.md §1)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", origin));
  }

  const { data } = await supabase.rpc("my_membership");
  const membership = (data ?? null) as unknown as Membership | null;
  // 소속이 없으면 담당 세무사로 연결된 회사가 있는지(D-148)
  const taxAgent = !membership && ((await supabase.rpc("my_tax_agent_companies")).data ?? []).length > 0;
  const response = NextResponse.redirect(new URL(destinationAfterLogin(membership, next, { taxAgent }), origin));
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  return response;
}
