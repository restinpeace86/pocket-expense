import Link from "next/link";
import { Suspense } from "react";
import { DocList } from "@/components/approval-docs/doc-list";
import { getAdminDocs, getDocForms, getTurnDocs } from "@/lib/approval-docs/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { DOC_TYPES } from "@/lib/company-forms/doc-types";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `결재 문서 · ${BRAND.name}` };

// 관리자 [결재 문서](9-33e4·e6): [승인 대기] = 최종 승인 차례(검토가 끝난 문서) / [전체] = 종류·달·상태·사람·제목으로 찾기
// 작성 중(올리기 전) 문서는 보이지 않는다(RLS)
export default function AdminDocsPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/docs">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/docs">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const tab = sp.tab === "all" ? "all" : "pending";
  const base = `/workspace/${id}/admin/docs`;
  const f = { docType: one(sp.type), month: one(sp.month), status: one(sp.status), member: one(sp.member), q: one(sp.q) };
  const supabase = await createClient();
  const [pending, rows, forms, { data: members }] = await Promise.all([
    getTurnDocs(membership.member_id, true),
    tab === "all" ? getAdminDocs(f) : Promise.resolve([]),
    getDocForms(),
    tab === "all" ? supabase.from("members").select("id, name").order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const types = DOC_TYPES.filter((d) => forms.some((x) => x.doc_type === d.code));
  const sel = "h-11 rounded-xl border border-zinc-300 bg-white px-2.5 text-sm";
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-10 pt-5 md:px-6" data-admin-docs>
      <div>
        <h1 className="text-xl font-bold tracking-tight">결재 문서</h1>
        <p className="mt-1 text-sm text-zinc-600">직원이 올린 품의서·구매요청서 같은 결재 문서예요. 결재라인 검토가 끝나면 여기서 최종 승인해요.</p>
      </div>
      <div className="flex gap-1 border-b border-zinc-200">
        {(
          [
            ["pending", `승인 대기${pending.length ? ` ${pending.length}` : ""}`],
            ["all", "전체 목록"],
          ] as const
        ).map(([k, l]) => (
          <Link key={k} href={`${base}?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px inline-flex h-11 items-center border-b-2 px-3 text-sm ${tab === k ? "border-brand-600 font-semibold text-brand-800" : "border-transparent text-zinc-600"}`}>
            {l}
          </Link>
        ))}
      </div>
      {tab === "pending" ? (
        <DocList rows={pending} href={(r) => `${base}/${r.id}`} empty={forms.length ? "최종 승인을 기다리는 문서가 없어요." : "아직 등록한 결재 문서 양식이 없어요. [설정 › 양식·결재 › 회사 양식]에서 등록하면 직원이 쓸 수 있어요."} showWriter showForm />
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-center gap-2" data-doc-filters>
            <input type="hidden" name="tab" value="all" />
            <select name="type" defaultValue={f.docType ?? ""} className={sel} aria-label="종류">
              <option value="">종류 전체</option>
              {types.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
            <input type="month" name="month" defaultValue={f.month ?? ""} className={sel} aria-label="올린 달" />
            <select name="status" defaultValue={f.status ?? ""} className={sel} aria-label="상태">
              <option value="">상태 전체</option>
              <option value="submitted">결재 중</option>
              <option value="approved">승인</option>
              <option value="rejected">반려</option>
            </select>
            <select name="member" defaultValue={f.member ?? ""} className={sel} aria-label="쓴 사람">
              <option value="">사람 전체</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input type="search" name="q" defaultValue={f.q ?? ""} placeholder="제목 찾기" className={`${sel} min-w-0 flex-1 basis-40`} aria-label="제목 찾기" />
            <button type="submit" className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white">
              찾기
            </button>
          </form>
          <DocList rows={rows} href={(r) => `${base}/${r.id}`} empty="조건에 맞는 문서가 없어요." showWriter showForm />
          {rows.length >= 300 && <p className="text-[13px] text-zinc-600">최근 300건까지 보여요. 달·종류로 좁혀 보세요.</p>}
        </>
      )}
    </main>
  );
}
