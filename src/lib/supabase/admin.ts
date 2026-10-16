import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

// service role 클라이언트 — RLS를 우회하므로 서버 코드에서만, 세션 사용자를 확인한 뒤에만 쓴다 (CLAUDE.md 제2장 제4조).
// 키가 없으면 null을 돌려 호출하는 쪽이 기능을 건너뛰게 한다.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const { url } = getSupabasePublicEnv();
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
