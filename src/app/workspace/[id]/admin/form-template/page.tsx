import { Suspense } from "react";
import { FormTemplateView } from "@/components/admin/form-template-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { getActiveForm } from "@/lib/forms/active";
import { DEFAULT_LAYOUT, SAMPLE_DOC } from "@/lib/forms/layout";
import { createClient } from "@/lib/supabase/server";
import { getClaimDocsByIds } from "@/lib/tax/claim-docs";

export const metadata = { title: "지출결의서 양식 · PocketExpense" };

// 지출결의서 양식 설정 (D-118, spec/screens/template-configuration.md)
export default function FormTemplatePage({ params }: PageProps<"/workspace/[id]/admin/form-template">) {
  return (
    <>
      <SectionHeading as="h1" title="지출결의서 양식" summary="결재·보관용 지출결의서 문서 모양을 정해요. 결의서 상세의 [지출결의서 PDF]와 세무 마감 PDF가 이 양식으로 나가요." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/form-template">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const [form, company, latest] = await Promise.all([
    getActiveForm(membership.company_id),
    supabase.from("companies").select("name").eq("id", membership.company_id).single(),
    // 미리보기는 가장 최근에 올라온 결의서로(없으면 예시)
    supabase.from("expense_claims").select("id").eq("company_id", membership.company_id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const docs = latest.data ? await getClaimDocsByIds(membership.company_id, [latest.data.id]) : [];
  const doc = docs[0]?.items.length ? docs[0] : null;
  return (
    <FormTemplateView
      companyId={membership.company_id}
      companyName={company.data?.name ?? ""}
      active={form ? { version: form.version, createdAt: form.createdAt } : null}
      initialLayout={form?.layout ?? DEFAULT_LAYOUT}
      previewDoc={doc ?? SAMPLE_DOC}
      previewLabel={doc ? `최근 결의서 '${doc.title}'` : "예시 결의서"}
    />
  );
}
