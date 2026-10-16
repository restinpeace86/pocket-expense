import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// 로그인과 무관한 공용 데이터(요금제 등)용 클라이언트. 쿠키·세션을 쓰지 않아 캐시해도 안전하다.
export function createPublicClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
