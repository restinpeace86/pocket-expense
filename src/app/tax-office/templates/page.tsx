import { Suspense } from "react";
import { TemplateManager, type OfficeTemplate } from "@/components/tax-office/template-manager";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, isActiveMember } from "@/lib/tax-office/queries";

export const metadata = { title: "결산 양식 · PocketExpense 세무사무소" };

// 월말 결산 양식 (D-150): 사무소 회계 프로그램의 엑셀 양식을 올리면 고객사 자료를 그 양식대로 채워 받는다
export default function TaxOfficeTemplatesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const state = await getMyTaxOffice();
  if (!isActiveMember(state)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("tax_office_template_list");
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">월말 결산 양식</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">
          회계 프로그램(더존·세무사랑 등)의 엑셀 업로드 양식을 한 번 올리면, 우리 사무소 고객사들의 월말 자료를 그 양식 그대로 채워 받을 수 있어요. 고객사 관리자도 세무
          마감 화면에서 이 양식으로 받아요.
        </p>
      </div>
      <TemplateManager templates={(data ?? []) as OfficeTemplate[]} canEdit={state.role === "admin"} />
    </>
  );
}
