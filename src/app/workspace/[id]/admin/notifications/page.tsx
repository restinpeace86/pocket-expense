import { Suspense } from "react";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { NotificationList, type NotificationRow } from "@/components/admin/notification-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "알림 이력 · PocketExpense" };

// 알림 이력 (T11-4 일부, kakao-alimtalk.md §5): 보낸 알림톡과 실패 사유. 관리자 이상, 자기 회사만(RLS)

export default function NotificationsPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/notifications">) {
  return (
    <>
      <SectionHeading as="h1" title="알림 이력" summary="상신·승인·반려·지급 완료 때 보낸 카카오 알림톡 기록이에요. 실패한 알림은 사유를 확인할 수 있어요." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Logs params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Logs({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/notifications">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const failedOnly = sp.status === "failed";
  const supabase = await createClient();
  let q = supabase
    .from("notification_logs")
    .select("id, claim_id, recipient_member_id, recipient_phone, template_code, payload, status, provider, error_message, created_at, sent_at")
    .eq("company_id", membership.company_id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (failedOnly) q = q.eq("status", "failed");
  const { data: logs } = await q;
  const rows = logs ?? [];
  const memberIds = [...new Set(rows.map((r) => r.recipient_member_id).filter((x): x is string => !!x))];
  const claimIds = [...new Set(rows.map((r) => r.claim_id).filter((x): x is string => !!x))];
  const [{ data: members }, { data: claims }] = await Promise.all([
    memberIds.length ? supabase.from("members").select("id, name").in("id", memberIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    claimIds.length ? supabase.from("expense_claims").select("id, title").in("id", claimIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const name = new Map((members ?? []).map((m) => [m.id, m.name]));
  const title = new Map((claims ?? []).map((c) => [c.id, c.title]));
  const devMode = (process.env.ALIMTALK_DRIVER ?? "log") === "log";
  return (
    <NotificationList
      devMode={devMode}
      failedOnly={failedOnly}
      base={`/workspace/${id}/admin/notifications`}
      rows={rows.map((r) => ({
        ...r,
        recipient_name: r.recipient_member_id ? (name.get(r.recipient_member_id) ?? "알 수 없음") : null,
        claim_title: r.claim_id ? (title.get(r.claim_id) ?? "(삭제됨)") : null,
        payload: (r.payload ?? {}) as NotificationRow["payload"],
      }))}
    />
  );
}
