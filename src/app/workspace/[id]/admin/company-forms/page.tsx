import { Suspense } from "react";
import { CompanyFormsView, type ActiveForm, type DraftForm } from "@/components/company-forms/company-forms-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import type { FormKind } from "@/lib/company-forms/model";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "회사 양식 · Moa-on" };

// 관리자 설정 › 회사 양식 (8-104 B④, spec/features/company-forms.md §B)
export default function CompanyFormsPage({ params }: PageProps<"/workspace/[id]/admin/company-forms">) {
  return (
    <>
      <SectionHeading as="h1" title="회사 양식" summary="회사에서 쓰던 휴가신청서·결재 문서를 등록하면, 결재가 끝난 문서가 그 모양으로 나와요." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/company-forms">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const [slots, rows] = await Promise.all([
    supabase.rpc("company_form_slots"),
    supabase
      .from("company_forms")
      .select("id, group_id, name, kind, version, status, fields, sheets, source_name, published_at, updated_at, created_by_name")
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: true }),
  ]);
  const s = (slots.data as unknown as { limit: number; used: number; requested: boolean } | null) ?? { limit: 1, used: 0, requested: false };
  const list = rows.data ?? [];
  const active = list.filter((r) => r.status === "active");
  const forms: ActiveForm[] = active.map((r) => ({
    id: r.id, group_id: r.group_id, name: r.name, kind: r.kind as FormKind, version: r.version, fields: r.fields as unknown as ActiveForm["fields"],
    sheets: r.sheets as unknown as ActiveForm["sheets"], published_at: r.published_at ?? r.updated_at, created_by_name: r.created_by_name,
  }));
  const drafts: DraftForm[] = list
    .filter((r) => r.status === "draft")
    .map((r) => ({
      id: r.id, group_id: r.group_id, name: r.name, kind: r.kind as FormKind | null, read: !!r.sheets, source_name: r.source_name, updated_at: r.updated_at,
      created_by_name: r.created_by_name, replaces: active.find((a) => a.group_id === r.group_id)?.name ?? null,
    }));
  return (
    <CompanyFormsView
      ws={`/workspace/${id}`}
      companyId={membership.company_id}
      me={membership.member_id}
      limit={s.limit}
      used={s.used}
      requested={s.requested}
      forms={forms}
      drafts={drafts}
    />
  );
}
