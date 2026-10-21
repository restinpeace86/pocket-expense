import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Dashboard } from "./dashboard";

// 관리자 홈 숫자 (DB 함수 admin_dashboard — 관리자만, 자기 회사만)
export async function getDashboard(month: string): Promise<Dashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard", { p_month: month });
  if (error || !data) return null;
  return data as unknown as Dashboard;
}
