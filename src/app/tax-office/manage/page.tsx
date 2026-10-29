import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CloseOfficeSection, LeaveOfficeSection } from "@/components/tax-office/office-actions";
import { OfficeInvite, OfficeMembers } from "@/components/tax-office/office-manage";
import { DefaultTitlesApply, type DefaultTitles } from "@/components/tax-office/default-titles";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, getTaxOfficeClients, isActiveMember } from "@/lib/tax-office/queries";

export const metadata = { title: "사무소 관리 · PocketExpense 세무사무소" };

// 사무소 관리 (D-149, D-152): 관리자 = 초대·구성원(이용 중지·사무소 관리자 바꾸기)·세무사무소 삭제 / 세무사 = 내 사무소(탈퇴)
export default function TaxOfficeManagePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const state = await getMyTaxOffice();
  if (!isActiveMember(state)) notFound();
  if (state.role !== "admin" || !state.invite_code) {
    return (
      <>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 사무소</h1>
          <p className="mt-1 break-keep text-sm text-zinc-600">
            {state.office_name}의 소속 세무사예요. 고객사 배정·초대·양식 관리는 사무소 관리자가 해요.
          </p>
        </div>
        <LeaveOfficeSection officeName={state.office_name} />
      </>
    );
  }
  const supabase = await createClient();
  const [{ data }, clients, { data: defaults }] = await Promise.all([supabase.rpc("tax_office_member_list"), getTaxOfficeClients(), supabase.rpc("tax_office_default_titles")]);
  const members = (data ?? []).map((m) => ({ ...m, assigned_count: Number(m.assigned_count) }));
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">사무소 관리</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">소속 세무사·직원을 초대하고, 고객사 목록에서 담당을 배정해요. 세무사는 배정된 고객사만 볼 수 있어요.</p>
      </div>
      <OfficeInvite code={state.invite_code} officeName={state.office_name} />
      <OfficeMembers members={members} myId={state.member_id} />
      <DefaultTitlesApply value={(defaults ?? null) as unknown as DefaultTitles} clients={clients.map((c) => ({ id: c.company_id, name: c.company_name }))} />
      <CloseOfficeSection officeName={state.office_name} memberCount={members.length} clientCount={clients.length} />
    </>
  );
}
