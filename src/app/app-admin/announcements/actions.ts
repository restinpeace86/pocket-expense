"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";
import { pushToAll } from "@/lib/push/server";

// 전체 공지 (D-116 채널 A): 앱 운영자(app_admins)만 → 모든 회사의 모든 사용자. 운영자 화면에서 유일하게 쓰는 기능(D-080 보완)
export async function postPlatformAnnouncementAction(input: { title: string; body: string }): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const ok = await getAppAdmin();
  if (!ok) return { ok: false, error: "운영자만 전체 공지를 올릴 수 있어요." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > 80) return { ok: false, error: "제목은 1~80자로 써 주세요." };
  if (!body || body.length > 1000) return { ok: false, error: "내용은 1~1000자로 써 주세요." };
  const { data, error } = await ok.admin.from("announcements").insert({ scope: "platform", title, body }).select("id").single();
  if (error || !data) return { ok: false, error: "공지를 올리지 못했어요." };
  const r = await pushToAll({ title: `[PocketExpense] ${title}`, body: body.slice(0, 120), tag: `notice-${data.id}` }, (cid) => `/workspace/${cid}/employee#notices`);
  await ok.admin.from("announcements").update({ pushed_count: r.sent }).eq("id", data.id);
  refresh();
  return { ok: true, sent: r.sent };
}
