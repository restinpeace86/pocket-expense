import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConvertEditor, type Conversion } from "@/components/doc-convert/convert-editor";
import { isAdminRole } from "@/lib/auth/paths";
import { requireWorkspace } from "@/lib/auth/guards";
import { validDoc } from "@/lib/doc-convert/model";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "서류 → 엑셀 · WORKON" };

// 변환 결과 보기·고치기(8-104 A③·A④, spec/features/company-forms.md §A)
export default function ConvertPage({ params }: PageProps<"/workspace/[id]/employee/convert/[cid]">) {
  return (
    <Suspense fallback={<div className="m-4 h-[70vh] animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/convert/[cid]">, "params">) {
  const { id, cid } = await params;
  if (!/^[0-9a-f-]{36}$/.test(cid)) notFound();
  const membership = await requireWorkspace(id);
  const supabase = await createClient();
  const { data } = await supabase
    .from("doc_conversions")
    .select("id, member_id, name, mime, source_path, status, scope, created_at, sheets")
    .eq("id", cid)
    .maybeSingle();
  if (!data || data.status === "reading" || !validDoc(data.sheets)) notFound();
  const mine = data.member_id === membership.member_id;
  const owner = mine ? membership.name : ((await supabase.from("members").select("name").eq("id", data.member_id).maybeSingle()).data?.name ?? "동료");
  return (
    <ConvertEditor
      key={data.id}
      ws={`/workspace/${id}`}
      conv={data as unknown as Conversion}
      mine={mine}
      canDelete={mine || (isAdminRole(membership.role) && data.status === "confirmed" && data.scope === "company")}
      ownerName={owner}
    />
  );
}
