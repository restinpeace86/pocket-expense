import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// 앱관리자(운영자) 화면 접근 확인 (D-080).
// 로그인한 계정이 public.app_admins에 있을 때만 통과. 아니면(로그인 안 함 포함) 404 — 이런 화면이 있다는 것도 알리지 않는다.
// 통과한 뒤에만 service role 클라이언트를 돌려준다. 운영자 화면은 읽기 전용이다.
export async function getAppAdmin() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("app_admins").select("auth_user_id").eq("auth_user_id", userId).maybeSingle();
  return data ? { admin, userId } : null;
}

export async function requireAppAdmin() {
  const ok = await getAppAdmin();
  if (!ok) notFound();
  return ok;
}
