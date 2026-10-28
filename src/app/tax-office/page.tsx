import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AssignSelect } from "@/components/tax-office/assign-select";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, getTaxOfficeClients, isActiveMember } from "@/lib/tax-office/queries";

// 세무사무소 첫 화면: 고객사 목록 (D-149). 관리자는 담당 세무사를 배정하고, 세무사는 맡은 고객사만 본다
export default function TaxOfficeHome() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Clients />
    </Suspense>
  );
}

const bizNo = (v: string) => (/^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v);

async function Clients() {
  const [state, clients] = await Promise.all([getMyTaxOffice(), getTaxOfficeClients()]);
  if (!isActiveMember(state)) return null; // 레이아웃이 등록·중지 화면을 보여 준다
  const isAdmin = state.role === "admin";
  let staff: { id: string; name: string }[] = [];
  if (isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("tax_office_member_list");
    staff = (data ?? []).filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }));
  }
  const unassigned = clients.filter((c) => !c.assigned_member_id).length;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{isAdmin ? "고객사" : "맡은 고객사"}</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">
          {isAdmin
            ? "고객사가 [설정 › 세무사무소]에 우리 사무소 이메일을 넣으면 자동으로 늘어나요. 담당 세무사를 배정하면 그 세무사도 볼 수 있어요."
            : "사무소 관리자가 배정한 고객사예요. 회사를 고르면 승인된 지출과 세무용 엑셀을 볼 수 있어요."}
        </p>
      </div>
      {isAdmin && unassigned > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">담당 세무사가 없는 고객사가 {unassigned}곳 있어요.</p>
      )}
      {clients.length === 0 ? (
        <p className="break-keep rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {isAdmin ? "아직 연결된 고객사가 없어요. 고객사에 우리 사무소 이메일로 지정해 달라고 알려 주세요." : "아직 맡은 고객사가 없어요. 사무소 관리자에게 배정을 요청해 주세요."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {clients.map((c) => (
            <li key={c.company_id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <Link href={`/tax-office/${c.company_id}`} className="flex min-h-12 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Building2 className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-zinc-900">{c.company_name}</span>
                  <span className="block text-xs text-zinc-500">{bizNo(c.business_number)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
              </Link>
              {isAdmin && (
                <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3">
                  <AssignSelect companyId={c.company_id} companyName={c.company_name} value={c.assigned_member_id} staff={staff} />
                  {c.agent_name && !c.assigned_member_id && (
                    <p className="break-all text-xs text-zinc-500">
                      고객사가 적은 담당: {c.agent_name}
                      {c.agent_email && ` (${c.agent_email})`}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
