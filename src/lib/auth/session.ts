import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./paths";

// 현재 로그인 사용자 id (JWT 검증). 로그인 안 했으면 null.
// 로그인 확인은 사용자마다 다르므로 요청 때 실행한다(connection). 세션 검사 안에서 현재 시각을 읽기 때문에
// 미리 렌더링(prerender) 단계에서 실행되면 Next가 "unstable value Date.now()" 오류를 낸다.
export async function getCurrentUserId(): Promise<string | null> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

// 내 소속. 회사 판별은 DB의 my_membership()(본인 행만 반환)으로만 한다.
export async function getMembership(): Promise<Membership | null> {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_membership");
  if (error || !data) return null;
  return data as unknown as Membership;
}
