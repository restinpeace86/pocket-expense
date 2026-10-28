import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OfficeInvite, OfficeMembers } from "@/components/tax-office/office-manage";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, isActiveMember } from "@/lib/tax-office/queries";

export const metadata = { title: "사무소 관리 · PocketExpense 세무사무소" };

// 사무소 관리(관리자, D-149): 소속 세무사 초대 링크·코드, 구성원 목록·이용 중지
export default function TaxOfficeManagePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const state = await getMyTaxOffice();
  if (!isActiveMember(state) || state.role !== "admin" || !state.invite_code) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("tax_office_member_list");
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">사무소 관리</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">소속 세무사·직원을 초대하고, 고객사 목록에서 담당을 배정해요. 세무사는 배정된 고객사만 볼 수 있어요.</p>
      </div>
      <OfficeInvite code={state.invite_code} officeName={state.office_name} />
      <OfficeMembers members={(data ?? []).map((m) => ({ ...m, assigned_count: Number(m.assigned_count) }))} myId={state.member_id} />
    </>
  );
}
