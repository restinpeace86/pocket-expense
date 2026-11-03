import "server-only";
import { createClient } from "@/lib/supabase/server";

// 사내 메신저 스위치(D-203): 회사별 company_features. 꺼져 있으면 메뉴·주소를 숨긴다
export async function chatEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_feature_enabled", { p_feature: "messenger" });
  return data === true;
}

// 메뉴 배지: 꺼져 있으면 null(메뉴 숨김), 켜져 있으면 안 읽은 메시지 수
export async function chatUnreadTotal(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_unread_total");
  if (error || data === null || data === undefined) return null;
  return data;
}
