import { Suspense } from "react";
import { InviteLinkCard } from "@/components/admin/invite-link-card";
import { MembersView } from "@/components/admin/members-view";
import { getCompanySummary, getMembers } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "멤버 관리 · PocketExpense" };

// 멤버 관리 (spec/screens/admin-team-members.md). 이번 범위: 초대 링크·QR, 가입 승인·거절, 목록
export default function MembersPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/members">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">멤버 관리</h1>
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
  const [members, { company }] = await Promise.all([getMembers(membership.company_id), getCompanySummary(membership.company_id)]);
  const hasPending = members.some((m) => m.status === "pending");
  const tab = sp.tab === "pending" || sp.tab === "inactive" || sp.tab === "all" ? sp.tab : hasPending ? "pending" : "all";

  return (
    <>
      {company && <InviteLinkCard inviteCode={company.invite_code} companyName={company.name} />}
      <MembersView members={members} tab={tab} basePath={`/workspace/${membership.company_id}/admin/members`} />
    </>
  );
}
