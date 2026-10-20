import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// 매 요청마다 Supabase 세션 토큰을 갱신한다(@supabase/ssr 권장 패턴).
// 인증 쿠키를 쓰는 응답은 CDN에 캐시되면 다른 사용자에게 세션이 넘어갈 수 있으므로 no-cache 헤더를 함께 붙인다.
export async function proxy(request: NextRequest) {
  // 반응형 점검용 미리보기(/dev/*)는 ENABLE_UI_PREVIEW=1일 때만. 배포 환경에서는 렌더링 전에 404로 막는다.
  if (request.nextUrl.pathname.startsWith("/dev/") && process.env.ENABLE_UI_PREVIEW !== "1") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // 토큰 검증·갱신. 접근 제어는 각 화면과 DB RLS가 한다.
  // 다만 로그인 안 한 워크스페이스 접근은 여기서 로그인으로 보낸다(로그인 후 원래 보던 화면으로 돌아오도록 경로 전체를 next로).
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  // 앱관리자(운영자) 화면(D-080): 로그인 안 했으면 로그인 화면으로(로그인 뒤 돌아옴),
  // 로그인했지만 운영자 계정이 아니면 화면을 그리기 전에 404. (화면 쪽 requireAppAdmin·조회 함수에서도 한 번 더 확인한다)
  if (pathname === "/app-admin" || pathname.startsWith("/app-admin/")) {
    const sub = data?.claims?.sub as string | undefined;
    if (!sub) {
      const to = new URL("/login", request.url);
      to.searchParams.set("next", pathname + search);
      const redirect = NextResponse.redirect(to);
      redirect.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      return redirect;
    }
    if (!(await isAppAdmin(url, sub))) return new NextResponse("Not Found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!data?.claims && pathname.startsWith("/workspace/")) {
    const to = new URL("/login", request.url);
    to.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return redirect;
  }
  return response;
}

// 서버 키 형식(예전 JWT 키 / 새 sb_secret_ 키)과 상관없이 화면 쪽(createAdminClient)과 같은 방식으로 확인한다
async function isAppAdmin(url: string, authUserId: string): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[app-admin] SUPABASE_SERVICE_ROLE_KEY가 없어 운영자 확인을 할 수 없습니다");
    return false;
  }
  try {
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from("app_admins").select("auth_user_id").eq("auth_user_id", authUserId).maybeSingle();
    if (error) console.error("[app-admin] 운영자 확인 실패:", error.message);
    return !!data;
  } catch (e) {
    console.error("[app-admin] 운영자 확인 오류:", e);
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)$).*)"],
};
