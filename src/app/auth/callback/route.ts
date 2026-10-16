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
  const response = NextResponse.redirect(new URL(destinationAfterLogin(membership, next), origin));
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  return response;
}
