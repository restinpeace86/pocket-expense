import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DocList } from "@/components/approval-docs/doc-list";
import { NewDocButton } from "@/components/approval-docs/new-doc-button";
import { getDocForms, getMyDocs } from "@/lib/approval-docs/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `결재 문서 · ${BRAND.name}` };

// 직원 [결재 문서](9-33e3, D-284 · company-forms.md §G-3): 위 탭 = 회사가 등록한 결재 문서 양식, 아래 = 그 양식의 내 문서 + [새로 쓰기]
// 회사가 결재 문서 양식을 하나도 등록 안 했으면 404(메뉴도 숨김)
export default function DocsPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/docs">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/docs">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id);
  const [forms, mine] = await Promise.all([getDocForms(), getMyDocs(membership.member_id)]);
  if (!forms.length && !mine.length) notFound();
  const ws = `/workspace/${id}`;
  // 탭: 지금 쓰는 양식 + (양식을 지웠어도) 내 문서가 남은 양식
  const tabs = [...forms.map((f) => ({ group: f.group_id, name: f.name, formId: f.id as string | null }))];
  for (const d of mine) if (!tabs.some((t) => t.group === d.form_group)) tabs.push({ group: d.form_group, name: d.form_name, formId: null });
  const cur = tabs.find((t) => t.group === sp.form) ?? tabs[0];
  const rows = mine.filter((d) => d.form_group === cur.group);
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-8 pt-5 md:max-w-2xl" data-docs-page>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">결재 문서</h1>
        {cur.formId && <NewDocButton companyId={id} formId={cur.formId} label={`${cur.name} 쓰기`} />}
      </div>
      {tabs.length > 1 && (
        <nav aria-label="결재 문서 종류" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" data-doc-tabs>
          {tabs.map((t) => (
            <Link
              key={t.group}
              href={`${ws}/employee/docs?form=${t.group}`}
              aria-current={t.group === cur.group ? "page" : undefined}
              className={`inline-flex h-10 shrink-0 items-center rounded-full border px-3.5 text-sm ${t.group === cur.group ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {t.name}
              {mine.filter((d) => d.form_group === t.group && d.status === "rejected").length > 0 && <span className="ml-1 size-1.5 rounded-full bg-red-500" aria-label="반려된 문서 있음" />}
            </Link>
          ))}
        </nav>
      )}
      {!cur.formId && <p className="rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13px] text-zinc-700">회사가 이 양식을 더 쓰지 않아요. 지난 문서만 볼 수 있어요.</p>}
      <DocList rows={rows} href={(r) => `${ws}/employee/docs/${r.id}`} empty={`아직 쓴 ${cur.name}가 없어요.`} />
      <p className="text-[12.5px] leading-relaxed text-zinc-600">쓴 문서는 결재라인(검토 → 관리자 최종 승인) 순서로 결재돼요. 승인되면 회사 양식 그대로 PDF·엑셀로 받을 수 있어요.</p>
    </main>
  );
}
