"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/paths";
import { pushToCompany } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 사내 공지 (D-116 채널 B): 그 회사 관리자 → 그 회사 직원만. 저장은 세션(RLS: 우리 회사 + 관리자 + 작성자 본인), 푸시는 그 회사 구독만
export async function postCompanyAnnouncementAction(input: { title: string; body: string }): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || !isAdminRole(m.role)) return { ok: false, error: "관리자만 사내 공지를 올릴 수 있어요." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > 80) return { ok: false, error: "제목은 1~80자로 써 주세요." };
  if (!body || body.length > 1000) return { ok: false, error: "내용은 1~1000자로 써 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").insert({ scope: "company", company_id: m.company_id, title, body, created_by_member_id: m.member_id }).select("id").single();
  if (error || !data) return { ok: false, error: "공지를 올리지 못했어요. 잠시 후 다시 시도해 주세요." };
  const r = await pushToCompany(m.company_id, { title: `[사내 공지] ${title}`, body: body.slice(0, 120), url: `/workspace/${m.company_id}/employee#notices`, tag: `notice-${data.id}` });
  await createAdminClient()?.from("announcements").update({ pushed_count: r.sent }).eq("id", data.id).eq("company_id", m.company_id);
  refresh();
  return { ok: true, sent: r.sent };
}
