"use server";

import { getMembership } from "@/lib/auth/session";
import { pushConfigured, pushToMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 이 기기(브라우저)에서 알림 받기 (D-116). 로그인한 활성 멤버 본인 것만.
type Result = { ok: true } | { ok: false; error: string };
export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function savePushSubscriptionAction(sub: BrowserSubscription, userAgent: string): Promise<Result> {
  const m = await getMembership();
  if (!m || m.status !== "approved") return { ok: false, error: "로그인한 멤버만 알림을 켤 수 있어요." };
  if (!pushConfigured()) return { ok: false, error: "알림 서버 설정이 아직 안 돼 있어요. 관리자에게 알려 주세요." };
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || p256dh.length < 20 || auth.length < 10) return { ok: false, error: "알림 등록 정보가 올바르지 않아요." };
  // 같은 기기를 다른 사람이 쓰던 경우(로그인 바꿈)를 위해 같은 주소의 예전 구독은 서버가 지우고 본인 것으로 등록
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").insert({ company_id: m.company_id, member_id: m.member_id, endpoint, p256dh, auth, user_agent: userAgent.slice(0, 300) || null });
  if (error) return { ok: false, error: "알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요." };
  return { ok: true };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<Result> {
  const m = await getMembership();
  if (!m) return { ok: false, error: "로그인이 필요해요." };
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

// 이 기기로 시험 알림
export async function sendTestPushAction(): Promise<Result & { sent?: number }> {
  const m = await getMembership();
  if (!m || m.status !== "approved") return { ok: false, error: "로그인이 필요해요." };
  const r = await pushToMembers(m.company_id, [m.member_id], { title: "알림이 켜졌어요", body: "마감 리마인더·결재 대기·공지를 이 기기로 받아요.", url: `/workspace/${m.company_id}/employee`, tag: "test" });
  if (!r.sent) return { ok: false, error: "시험 알림을 보내지 못했어요. 알림을 다시 켜 주세요." };
  return { ok: true, sent: r.sent };
}

// 이 기기 [알림 올 때 소리·진동](D-214) — 본인 구독만(RLS). 끄면 서버가 이 기기에는 조용한 알림(배너만)으로 보낸다
export async function getPushVibrateAction(endpoint: string): Promise<boolean | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("vibrate").eq("endpoint", endpoint).maybeSingle();
  return data ? data.vibrate : null;
}

export async function setPushVibrateAction(endpoint: string, on: boolean): Promise<Result> {
  const m = await getMembership();
  if (!m) return { ok: false, error: "로그인이 필요해요." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("push_subscriptions").update({ vibrate: !!on }).eq("endpoint", endpoint).select("id");
  if (error || !data?.length) return { ok: false, error: "저장하지 못했어요. 알림을 다시 켜 주세요." };
  return { ok: true };
}

// ── 안드로이드 설치 앱 알림(FCM, D-228) — 이 기기 토큰 등록·삭제. 본인 것만(RLS)
const FCM_TOKEN = /^[A-Za-z0-9_:\-.]{20,4096}$/;
export async function saveAppTokenAction(token: string, appVersion?: string): Promise<Result> {
  const m = await getMembership();
  if (!m || m.status !== "approved") return { ok: false, error: "로그인한 멤버만 알림을 켤 수 있어요." };
  const t = String(token ?? "");
  if (!FCM_TOKEN.test(t)) return { ok: false, error: "알림 등록 정보가 올바르지 않아요." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  // 이미 본인 것으로 있으면 그대로(앱을 열 때마다 부름)
  const supabase = await createClient();
  const { data: mine } = await supabase.from("push_app_tokens").select("id").eq("token", t).maybeSingle();
  if (mine) return { ok: true };
  // 같은 휴대폰을 다른 사람이 쓰던 경우(로그인 바꿈) 예전 것은 서버가 지우고 본인 것으로
  await admin.from("push_app_tokens").delete().eq("token", t);
  const { error } = await supabase.from("push_app_tokens").insert({ company_id: m.company_id, member_id: m.member_id, token: t, app_version: appVersion ? String(appVersion).slice(0, 40) : null });
  if (error) return { ok: false, error: "알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요." };
  return { ok: true };
}

export async function deleteAppTokenAction(token: string): Promise<Result> {
  const m = await getMembership();
  if (!m) return { ok: false, error: "로그인이 필요해요." };
  const supabase = await createClient();
  await supabase.from("push_app_tokens").delete().eq("token", String(token ?? ""));
  return { ok: true };
}
