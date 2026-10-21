import "server-only";
import { createClient } from "@/lib/supabase/server";

// 개별 초대 대기 목록 (admin-team-members.md §A, D-042). 관리자만·자기 회사만(RLS)
export type InvitationRow = { id: string; name: string; phone: string | null; department: string | null; position: string | null; token: string; last_sent_at: string | null; created_at: string };

export async function getPendingInvitations(companyId: string): Promise<InvitationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_invitations")
    .select("id, name, phone, position, token, last_sent_at, created_at, department:departments(name)")
    .eq("company_id", companyId)
    .eq("status", "invited")
    .order("created_at", { ascending: false });
  return (data ?? []).map(({ department, ...r }) => ({ ...r, department: (department as { name: string } | null)?.name ?? null }));
}
