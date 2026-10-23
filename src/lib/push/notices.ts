import "server-only";
import { createClient } from "@/lib/supabase/server";

// 최근 공지(D-116): 전체(앱 운영자) + 우리 회사 공지. 읽기 권한은 RLS(우리 회사 공지만 + 전체 공지)
export type Notice = { id: string; scope: "platform" | "company"; title: string; body: string; created_at: string };
export async function getRecentNotices(limit = 3, days = 30): Promise<Notice[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await supabase.from("announcements").select("id, scope, title, body, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Notice[];
}
