import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MemberDetailView } from "@/components/admin/member-detail";
import { capabilitiesFor } from "@/lib/admin/capabilities";
import { getCompanyMealLimit, getDepartments, getMember } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "멤버 정보 · PocketExpense" };

type Props = PageProps<"/workspace/[id]/admin/members/[memberId]">;

export default function MemberPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <MemberContent params={params} />
    </Suspense>
  );
}

async function MemberContent({ params }: { params: Props["params"] }) {
  const { id, memberId } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const [member, departments, companyMealLimit] = await Promise.all([
    getMember(membership.company_id, memberId),
    getDepartments(membership.company_id),
    getCompanyMealLimit(membership.company_id),
  ]);
  if (!member) notFound();
  return (
    <MemberDetailView
      member={member}
      departments={departments.map(({ id, name }) => ({ id, name }))}
      can={capabilitiesFor(membership, member)}
      backHref={`/workspace/${membership.company_id}/admin/members`}
      companyMealLimit={companyMealLimit}
    />
  );
}
