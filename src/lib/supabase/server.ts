import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "./env";

// 서버(Server Component, Server Function, Route Handler)용 Supabase 클라이언트.
// cacheComponents가 켜져 있으므로 이 함수를 부르는 컴포넌트는 <Suspense> 안에 있어야 한다.
export async function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy/Route Handler에서 처리한다.
        }
      },
    },
  });
}
