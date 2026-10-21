import { Suspense } from "react";
import { InviteLinkCard } from "@/components/admin/invite-link-card";
import { MembersHeading, MembersView } from "@/components/admin/members-view";
import { InvitePanel } from "@/components/admin/invite-panel";
import { ReminderPanel } from "@/components/admin/reminder-panel";
import { getPendingInvitations } from "@/lib/admin/invitations";
import { createClient } from "@/lib/supabase/server";
import { getCompanySummary, getDepartments, getMembers } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "멤버 관리 · PocketExpense" };

// 멤버 관리 (spec/screens/admin-team-members.md). 이번 범위: 초대 링크·QR, 가입 승인·거절, 목록
export default function MembersPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/members">) {
  return (
    <>
      <MembersHeading />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Members params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Members({
  params,
  searchParams,
}: {
  params: PageProps<"/workspace/[id]/admin/members">["params"];
  searchParams: PageProps<"/workspace/[id]/admin/members">["searchParams"];
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const [members, { company }, { data: candidates }, invitations, departments] = await Promise.all([
    getMembers(membership.company_id),
    getCompanySummary(membership.company_id),
    supabase.rpc("reminder_candidates"),
    getPendingInvitations(membership.company_id),
    getDepartments(membership.company_id),
  ]);
  const hasPending = members.some((m) => m.status === "pending");
  const tab = sp.tab === "pending" || sp.tab === "inactive" || sp.tab === "all" ? sp.tab : hasPending ? "pending" : "all";

  return (
    <>
      <InvitePanel departments={departments.map((d) => ({ id: d.id, name: d.name }))} invitations={invitations} actions={<ReminderPanel candidates={candidates ?? []} />} />
      {company && <InviteLinkCard inviteCode={company.invite_code} companyName={company.name} compact />}
      <MembersView members={members} tab={tab} basePath={`/workspace/${membership.company_id}/admin/members`} reminders={candidates ?? []} />
    </>
  );
}
