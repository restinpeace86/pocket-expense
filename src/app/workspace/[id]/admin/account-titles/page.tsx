import { Suspense } from "react";
import { AccountTitlesHeading, AccountTitlesView } from "@/components/admin/account-titles-view";
import { getAccountTitles } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "계정과목 · PocketExpense" };

// 계정과목 (spec/screens/admin-dashboard.md ⑪, spec/features/account-titles.md)
export default function AccountTitlesPage({ params }: PageProps<"/workspace/[id]/admin/account-titles">) {
  return (
    <>
      <AccountTitlesHeading />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/account-titles">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const { titles, mappings } = await getAccountTitles(membership.company_id);
  return <AccountTitlesView titles={titles} mappings={mappings} />;
}
