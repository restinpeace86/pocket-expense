import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { FormEditor, type EditorForm } from "@/components/company-forms/form-editor";
import { requireWorkspace } from "@/lib/auth/guards";
import { signedFormSource } from "@/lib/company-forms/server";
import { validDoc } from "@/lib/doc-convert/model";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `회사 양식 등록 · ${BRAND.name}` };

// 회사 양식 등록 PC 편집(8-104 B②·B③, spec/features/company-forms.md §B-2)
export default function CompanyFormEditPage({ params }: PageProps<"/workspace/[id]/admin/company-forms/[fid]">) {
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/admin/company-forms/[fid]">, "params">) {
  const { id, fid } = await params;
  if (!/^[0-9a-f-]{36}$/.test(fid)) notFound();
  await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  // RLS: 같은 회사 관리자만 초안을 읽는다
  const { data } = await supabase.from("company_forms").select("id, group_id, name, kind, status, sheets, fields, reads, mime, source_path").eq("id", fid).maybeSingle();
  if (!data) notFound();
  if (data.status !== "draft" || !data.kind || !validDoc(data.sheets)) redirect(`/workspace/${id}/admin/company-forms`);
  const [active, src] = await Promise.all([
    supabase.from("company_forms").select("name").eq("group_id", data.group_id).eq("status", "active").maybeSingle(),
    signedFormSource(data.source_path),
  ]);
  const form: EditorForm = {
    id: data.id, group_id: data.group_id, name: data.name, kind: data.kind as EditorForm["kind"], sheets: data.sheets as unknown as EditorForm["sheets"],
    fields: data.fields as unknown as EditorForm["fields"], reads: data.reads, mime: data.mime, replaces: active.data?.name ?? null,
  };
  return <FormEditor key={`${data.id}:${data.reads}`} ws={`/workspace/${id}`} form={form} src={src} />;
}
