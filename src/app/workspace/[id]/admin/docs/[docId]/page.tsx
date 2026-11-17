import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DocView } from "@/components/approval-docs/doc-view";
import { getDocDetail } from "@/lib/approval-docs/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `결재 문서 · ${BRAND.name}` };

// 관리자 결재 문서 한 건(9-33e4): 회사 양식 보기·첨부·결재 진행 + 최종 승인 차례면 승인/반려
export default function AdminDocPage({ params }: PageProps<"/workspace/[id]/admin/docs/[docId]">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 flex-1 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/admin/docs/[docId]">, "params">) {
  const { id, docId } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const d = await getDocDetail(docId, membership);
  if (!d || d.doc.status === "draft") notFound();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-10 pt-4 md:px-6">
      <Link href={`/workspace/${id}/admin/docs`} className="-ml-1 inline-flex h-10 w-fit items-center gap-1 rounded-lg pr-2 text-sm text-zinc-600 hover:bg-zinc-100">
        <ChevronLeft className="size-5" aria-hidden />
        결재 문서
      </Link>
      <DocView companyId={id} doc={d.doc} fields={d.form.fields} steps={d.steps} files={d.files} can={{ recall: d.can.recall, decide: d.can.decide }} />
    </main>
  );
}
