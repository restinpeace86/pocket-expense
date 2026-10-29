import "server-only";
import webpush from "web-push";
import { configuredSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

// 웹푸시 보내기 (D-116). 무료(VAPID) — 브라우저 회사(구글·애플·모질라)의 푸시 서버로 보낸다.
// - 키: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(운영 주소). 없으면 보내지 않고 0을 돌려준다.
// - 받는 사람 조회·기록은 service role로 하고, 부르는 쪽이 회사·권한을 먼저 확인한다.
// - 404·410(구독 끝남)이면 그 구독을 지운다. 같은 날 같은 리마인더는 push_logs로 한 번만.
export type PushPayload = { title: string; body: string; url: string; tag?: string };
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Sub = { id: string; member_id: string; endpoint: string; p256dh: string; auth: string };

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || configuredSiteUrl() || "mailto:noreply@pocketexpense.app", pub, priv);
  return (configured = true);
}

// table: 회사 멤버 구독(push_subscriptions) / 세무사무소 구성원 구독(tax_office_push_subscriptions, D-168)
type SubTable = "push_subscriptions" | "tax_office_push_subscriptions";
async function sendAll(admin: Admin, subs: Sub[], payload: PushPayload, table: SubTable = "push_subscriptions"): Promise<{ sent: number; failed: number; byMember: Map<string, number> }> {
  const byMember = new Map<string, number>();
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const body = JSON.stringify(payload);
  // 한 번에 너무 많이 보내지 않게 20개씩
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(
      subs.slice(i, i + 20).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: "normal" });
          sent++;
          byMember.set(s.member_id, (byMember.get(s.member_id) ?? 0) + 1);
        } catch (e) {
          failed++;
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.id);
        }
      }),
    );
  }
  if (gone.length) await admin.from(table).delete().in("id", gone);
  const ok = subs.filter((s) => !gone.includes(s.id)).map((s) => s.id);
  if (ok.length && sent) await admin.from(table).update({ last_sent_at: new Date().toISOString() }).in("id", ok);
  return { sent, failed, byMember };
}

// 특정 멤버들(같은 회사)에게. dedupe가 있으면 오늘 같은 알림을 이미 받은 멤버는 건너뛴다
export async function pushToMembers(
  companyId: string,
  memberIds: string[],
  payload: PushPayload,
  dedupe?: { kind: "deadline" | "approval_pending" | "closing"; ref: string },
): Promise<{ members: number; sent: number; failed: number }> {
  const admin = createAdminClient();
  if (!admin || !pushConfigured() || !memberIds.length) return { members: 0, sent: 0, failed: 0 };
  let targets = [...new Set(memberIds)];
  if (dedupe) {
    // 오늘 처음인 멤버만 남긴다(기록이 이미 있으면 건너뜀)
    const { data } = await admin
      .from("push_logs")
      .upsert(targets.map((m) => ({ company_id: companyId, member_id: m, kind: dedupe.kind, ref: dedupe.ref })), { onConflict: "member_id,kind,ref,sent_on", ignoreDuplicates: true })
      .select("member_id");
    targets = (data ?? []).map((r) => r.member_id).filter((x): x is string => !!x);
  }
  if (!targets.length) return { members: 0, sent: 0, failed: 0 };
  const { data: subs } = await admin.from("push_subscriptions").select("id, member_id, endpoint, p256dh, auth").eq("company_id", companyId).in("member_id", targets);
  const r = await sendAll(admin, (subs ?? []) as Sub[], payload);
  return { members: r.byMember.size, sent: r.sent, failed: r.failed };
}

// 회사 전체(사내 공지) — 그 회사 구독만
export async function pushToCompany(companyId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  if (!admin || !pushConfigured()) return { sent: 0, failed: 0 };
  const { data: subs } = await admin.from("push_subscriptions").select("id, member_id, endpoint, p256dh, auth").eq("company_id", companyId);
  const r = await sendAll(admin, (subs ?? []) as Sub[], payload);
  return { sent: r.sent, failed: r.failed };
}

// 플랫폼 전체(앱 운영자 공지) — 모든 구독. url은 회사마다 다르므로 회사별로 나눠 보낸다
export async function pushToAll(payload: Omit<PushPayload, "url">, urlFor: (companyId: string) => string): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  if (!admin || !pushConfigured()) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from("push_subscriptions").select("id, member_id, company_id, endpoint, p256dh, auth").order("id").range(from, from + 999);
    if (!data?.length) break;
    const byCompany = new Map<string, Sub[]>();
    for (const s of data) byCompany.set(s.company_id, [...(byCompany.get(s.company_id) ?? []), s as Sub]);
    for (const [cid, subs] of byCompany) {
      const r = await sendAll(admin, subs, { ...payload, url: urlFor(cid) });
      sent += r.sent;
      failed += r.failed;
    }
    if (data.length < 1000) break;
  }
  return { sent, failed };
}

// 세무사무소 구성원에게 (D-168). 부르는 쪽이 대상(담당 세무사·사무소 관리자)을 먼저 정한다
export async function pushToOfficeMembers(officeMemberIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  if (!admin || !pushConfigured() || !officeMemberIds.length) return { sent: 0, failed: 0 };
  const { data } = await admin.from("tax_office_push_subscriptions").select("id, office_member_id, endpoint, p256dh, auth").in("office_member_id", [...new Set(officeMemberIds)]);
  const subs = (data ?? []).map((s) => ({ id: s.id, member_id: s.office_member_id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
  const r = await sendAll(admin, subs, payload, "tax_office_push_subscriptions");
  return { sent: r.sent, failed: r.failed };
}
