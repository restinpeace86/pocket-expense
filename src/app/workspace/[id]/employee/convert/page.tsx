import { Suspense } from "react";
import { ConvertList, type ConversionRow } from "@/components/doc-convert/convert-list";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "서류 → 엑셀 · Moa-on" };

// 서류 → 엑셀(8-104 A-1): 기기에서 사진·PDF 고르기 + 내 변환 / 회사 공유
export default function ConvertListPage({ params }: PageProps<"/workspace/[id]/employee/convert">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/convert">, "params">) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  const supabase = await createClient();
  const { data } = await supabase
    .from("doc_conversions")
    .select("id, member_id, name, mime, status, scope, pages, created_at")
    .neq("status", "reading")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as ConversionRow[];
  const owners = [...new Set(rows.map((r) => r.member_id).filter((x) => x !== membership.member_id))];
  const people = owners.length ? ((await supabase.from("members").select("id, name").in("id", owners)).data ?? []) : [];
  return (
    <ConvertList
      ws={`/workspace/${id}`}
      companyId={membership.company_id}
      me={membership.member_id}
      rows={rows}
      people={Object.fromEntries(people.map((p) => [p.id, p.name]))}
    />
  );
}
