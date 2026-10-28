import { Suspense } from "react";
import { AccountTitlesHeading, AccountTitlesView } from "@/components/admin/account-titles-view";
import { getAccountTitles } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AccountTitleHistory, type AccountTitleChange } from "@/components/tax-office/account-title-history";

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
  const supabase = await createClient();
  const [{ titles, mappings }, { data: office }, { data: changes }] = await Promise.all([
    getAccountTitles(membership.company_id),
    supabase.rpc("my_company_tax_office"),
    supabase.from("account_title_changes").select("id, entity, action, detail, actor_name, office_name, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  // 등록된 세무사무소와 연결되어 있으면 계정과목은 사무소가 관리하고 회사는 보기만(D-152)
  const o = office as { registered?: boolean; registered_name?: string | null } | null;
  const managed = !!o?.registered;
  return (
    <>
      {managed && (
        <p className="break-keep rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <b>{o?.registered_name}</b>이(가) 우리 회사 계정과목을 관리해요. 바꿔야 할 곳이 있으면 세무사무소에 요청해 주세요. 세무사무소가 바꾼 내용은 아래 이력에 남아요.
        </p>
      )}
      <AccountTitlesView titles={titles} mappings={mappings} readOnly={managed} />
      {(managed || (changes ?? []).length > 0) && <AccountTitleHistory changes={(changes ?? []) as AccountTitleChange[]} />}
    </>
  );
}
