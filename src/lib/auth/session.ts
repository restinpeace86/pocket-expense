import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./paths";

// 현재 로그인 사용자 id (JWT 검증). 로그인 안 했으면 null.
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

// 내 소속. 회사 판별은 DB의 my_membership()(본인 행만 반환)으로만 한다.
export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_membership");
  if (error || !data) return null;
  return data as unknown as Membership;
}
