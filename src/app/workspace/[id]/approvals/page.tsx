import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminClaimList } from "@/components/claims/admin-claim-list";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/paths";
import { getReviewerInbox } from "@/lib/claims/inbox";
import { DocList } from "@/components/approval-docs/doc-list";
import { getDoneDocs, getTurnDocs } from "@/lib/approval-docs/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `결재함 · ${BRAND.name}` };

// 내 결재함 (approver.md ②). 관리자 이상은 [지출 승인 관리]와 같은 목록이라 그쪽으로 보낸다
export default function InboxPage({ params, searchParams }: PageProps<"/workspace/[id]/approvals">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-64 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Inbox params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Inbox({ params, searchParams }: Pick<PageProps<"/workspace/[id]/approvals">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id);
  if (isAdminRole(membership.role)) redirect(`/workspace/${id}/admin/claims`);
  const tab = sp.tab === "done" ? "done" : "waiting";
  const [rows, docs] = await Promise.all([getReviewerInbox(membership.company_id, membership.member_id, tab), tab === "waiting" ? getTurnDocs(membership.member_id, false) : getDoneDocs(membership.member_id)]);
  const base = `/workspace/${id}/approvals`;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6 pt-5 md:max-w-2xl">
      <h1 className="text-xl font-bold tracking-tight">결재함</h1>
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        {(
          [
            ["waiting", "대기"],
            ["done", "처리완료"],
          ] as const
        ).map(([k, l]) => (
          <Link key={k} href={`${base}?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm ${tab === k ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}>
            {l}
          </Link>
        ))}
      </div>
      {docs.length > 0 && (
        <section aria-labelledby="inbox-docs" className="flex flex-col gap-2" data-inbox-docs>
          <h2 id="inbox-docs" className="text-[15px] font-bold">
            결재 문서 <span className="font-normal text-zinc-500">{docs.length}</span>
          </h2>
          <DocList rows={docs} href={(r) => `/workspace/${id}/employee/docs/${r.id}`} empty="" showWriter showForm />
        </section>
      )}
      {docs.length > 0 && <h2 className="-mb-2 text-[15px] font-bold">지출결의서</h2>}
      {tab === "waiting" && rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">결재할 결의서가 없어요.</p>
      ) : (
        <AdminClaimList rows={rows} tab={tab === "waiting" ? "pending" : "done"} base={base} />
      )}
    </main>
  );
}
