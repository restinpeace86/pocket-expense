import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DocEditor } from "@/components/approval-docs/doc-editor";
import { DocView } from "@/components/approval-docs/doc-view";
import { getDocDetail, getLinePreview } from "@/lib/approval-docs/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `결재 문서 · ${BRAND.name}` };

// 결재 문서 한 건(9-33e3·e4): 내 작성 중·반려 문서 = 쓰기, 그 밖(올린 뒤·검토자·관리자) = 보기 + 내 차례면 결재
export default function DocPage({ params }: PageProps<"/workspace/[id]/employee/docs/[docId]">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/docs/[docId]">, "params">) {
  const { id, docId } = await params;
  const membership = await requireWorkspace(id);
  const d = await getDocDetail(docId, membership);
  if (!d) notFound();
  const ws = `/workspace/${id}`;
  const mine = d.doc.member_id === membership.member_id;
  const back = mine ? `${ws}/employee/docs?form=${d.form.group_id}` : `${ws}/approvals`;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-10 pt-4 md:max-w-2xl">
      <Link href={back} className="-ml-1 inline-flex h-10 w-fit items-center gap-1 rounded-lg pr-2 text-sm text-zinc-600 hover:bg-zinc-100">
        <ChevronLeft className="size-5" aria-hidden />
        {mine ? "내 결재 문서" : "결재함"}
      </Link>
      {d.can.edit ? (
        <DocEditor
          companyId={id}
          memberId={membership.member_id}
          doc={{ id: d.doc.id, title: d.doc.title, doc_type: d.doc.doc_type, payload: d.doc.payload, status: d.doc.status, rejection_reason: d.doc.rejection_reason, form_name: d.form.name }}
          fields={d.form.fields}
          members={d.members}
          files={d.files}
          line={await getLinePreview(membership)}
          canDelete={d.can.delete}
          formActive={d.form.active}
        />
      ) : (
        <DocView companyId={id} doc={d.doc} fields={d.form.fields} steps={d.steps} files={d.files} can={d.can} />
      )}
    </main>
  );
}
