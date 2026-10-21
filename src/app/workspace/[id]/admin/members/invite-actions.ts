"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { messageForDbError } from "@/lib/errors";
import { sendInvite } from "@/lib/notify/dispatch";
import { normalizePhone } from "@/lib/notify/templates";
import { createClient } from "@/lib/supabase/server";

// 개별 초대 (admin-team-members.md §A, D-042): 이름·휴대폰·부서·직급으로 초대 → 알림톡 또는 링크 복사.
// 링크로 가입하면 승인 없이 바로 활성(accept_invitation). 권한·회사 격리는 RLS(관리자만, 자기 회사만)가 다시 막는다.
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (code: string) => ({ ok: false as const, error: messageForDbError({ message: code }) });
const UUID = /^[0-9a-f-]{36}$/i;

async function admin() {
  const m = await getMembership();
  return m && m.status === "approved" && isAdminRole(m.role) ? m : null;
}

export async function createInvitationAction(input: { name: string; phone: string; departmentId: string | null; position: string; send: boolean }): Promise<R<{ token: string; sent: boolean }>> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  const name = input.name.trim();
  const position = input.position.trim();
  const phone = normalizePhone(input.phone);
  if (!name || name.length > 50) return fail("INVALID_NAME");
  if (!phone) return fail("INVALID_PHONE");
  if (position.length > 50) return fail("INVALID_TEXT_LENGTH");
  if (input.departmentId && !UUID.test(input.departmentId)) return fail("INVALID_DEPARTMENT");
  const supabase = await createClient();
  const [{ data: member }, { data: open }] = await Promise.all([
    supabase.from("members").select("name, status").eq("company_id", m.company_id).eq("phone", phone).neq("status", "inactive").maybeSingle(),
    supabase.from("member_invitations").select("id").eq("company_id", m.company_id).eq("phone", phone).eq("status", "invited").maybeSingle(),
  ]);
  if (member) return { ok: false, error: `이미 ${member.status === "pending" ? "가입 신청한" : "가입한"} 번호예요(${member.name}). 멤버 목록에서 확인해 주세요.` };
  if (open) return { ok: false, error: "이 번호로 보낸 초대가 이미 있어요. 아래 초대 대기 목록에서 다시 보내거나 링크를 복사해 주세요." };
  const { data, error } = await supabase
    .from("member_invitations")
    .insert({ company_id: m.company_id, name, phone, department_id: input.departmentId || null, position: position || null, invited_by_member_id: m.member_id })
    .select("id, token")
    .single();
  if (error || !data) return { ok: false, error: messageForDbError(error ?? { message: "NOT_ALLOWED" }) };
  const sent = input.send ? await sendInvite(m.company_id, data.id) : false;
  refresh();
  return { ok: true, token: data.token, sent };
}

export async function resendInvitationAction(id: string): Promise<R> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  if (!UUID.test(id)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data } = await supabase.from("member_invitations").select("id").eq("id", id).eq("company_id", m.company_id).eq("status", "invited").maybeSingle();
  if (!data) return fail("INVALID_INVITATION");
  await sendInvite(m.company_id, id);
  refresh();
  return { ok: true };
}

export async function cancelInvitationAction(id: string): Promise<R> {
  const m = await admin();
  if (!m) return fail("NOT_ALLOWED");
  if (!UUID.test(id)) return fail("NOT_FOUND");
  const supabase = await createClient();
  const { data, error } = await supabase.from("member_invitations").update({ status: "canceled" }).eq("id", id).eq("company_id", m.company_id).eq("status", "invited").select("id");
  if (error) return { ok: false, error: messageForDbError(error) };
  if (!data?.length) return fail("INVALID_INVITATION");
  refresh();
  return { ok: true };
}
