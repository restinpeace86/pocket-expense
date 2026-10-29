"use server";

import { pushConfigured, pushToOfficeMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyTaxOffice, isActiveMember } from "@/lib/tax-office/queries";
import type { BrowserSubscription } from "@/app/push/actions";

// 세무사무소: 이 기기에서 알림 받기 (D-168) — 고객사 마감·자료 요청 답변. 활성 사무소 구성원 본인 것만, 표는 서버만 읽고 쓴다
type Result = { ok: true } | { ok: false; error: string };

async function me() {
  const s = await getMyTaxOffice();
  return isActiveMember(s) ? s : null;
}

export async function saveOfficePushAction(sub: BrowserSubscription, userAgent: string): Promise<Result> {
  const m = await me();
  if (!m) return { ok: false, error: "세무사무소 구성원만 알림을 켤 수 있어요." };
  if (!pushConfigured()) return { ok: false, error: "알림 서버 설정이 아직 안 돼 있어요." };
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || p256dh.length < 20 || auth.length < 10) return { ok: false, error: "알림 등록 정보가 올바르지 않아요." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  // 같은 기기를 회사 계정으로도 쓰던 경우까지 정리하고 본인 것으로
  await Promise.all([admin.from("tax_office_push_subscriptions").delete().eq("endpoint", endpoint), admin.from("push_subscriptions").delete().eq("endpoint", endpoint)]);
  const { error } = await admin.from("tax_office_push_subscriptions").insert({ office_member_id: m.member_id, endpoint, p256dh, auth, user_agent: userAgent.slice(0, 300) || null });
  if (error) return { ok: false, error: "알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요." };
  return { ok: true };
}

export async function deleteOfficePushAction(endpoint: string): Promise<Result> {
  const m = await me();
  const admin = createAdminClient();
  if (!m || !admin) return { ok: false, error: "로그인이 필요해요." };
  await admin.from("tax_office_push_subscriptions").delete().eq("endpoint", endpoint).eq("office_member_id", m.member_id);
  return { ok: true };
}

export async function testOfficePushAction(): Promise<Result & { sent?: number }> {
  const m = await me();
  if (!m) return { ok: false, error: "로그인이 필요해요." };
  const r = await pushToOfficeMembers([m.member_id], { title: "알림이 켜졌어요", body: "고객사 마감 완료·자료 요청 답변을 이 기기로 받아요.", url: "/tax-office", tag: "test" });
  if (!r.sent) return { ok: false, error: "시험 알림을 보내지 못했어요. 알림을 다시 켜 주세요." };
  return { ok: true, sent: r.sent };
}
