import { Suspense } from "react";
import { MonthPicker } from "@/components/tax-office/month-picker";
import { OfficeDashboard } from "@/components/tax-office/office-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, getTaxOfficeClients, isActiveMember } from "@/lib/tax-office/queries";
import { currentMonthKst } from "@/lib/dates";
import { prevMonth, type ClientRow, type ClientStatus } from "@/lib/tax-office/dashboard";

// 세무사무소 첫 화면: 고객사 현황판 (D-149 → D-193 → D-268). 관리자는 모든 고객사·담당 배정, 세무사는 맡은 고객사만.
// 고른 달(기본 = 지난달, 지금 마감하는 달)의 마감 상태·확인할 것·마지막 올림·사무소 확인을 표로. 여러 곳 골라 ZIP·자료 요청·공지
export default function TaxOfficeHome({ searchParams }: PageProps<"/tax-office">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Clients searchParams={searchParams} />
    </Suspense>
  );
}

function recentMonths(now: string): string[] {
  const [y, m] = now.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

async function Clients({ searchParams }: Pick<PageProps<"/tax-office">, "searchParams">) {
  const supabase = await createClient(); // 쿠키를 먼저 읽어 이 화면을 요청 때 그리게(현재 달 계산이 미리 그리기에 걸리지 않게)
  const sp = await searchParams;
  const now = currentMonthKst();
  const month = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) && sp.month <= now ? sp.month : prevMonth(now);
  const [state, clients, { data: statusData }] = await Promise.all([getMyTaxOffice(), getTaxOfficeClients(), supabase.rpc("tax_office_client_status", { p_month: month })]);
  if (!isActiveMember(state)) return null; // 레이아웃이 등록·중지 화면을 보여 준다
  const status = new Map(((statusData ?? []) as unknown as ClientStatus[]).map((x) => [x.company_id, x]));
  const mLabel = `${Number(month.slice(5))}월`;
  const closedCount = clients.filter((c) => status.get(c.company_id)?.closed).length;
  const isAdmin = state.role === "admin";
  let staff: { id: string; name: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase.rpc("tax_office_member_list");
    staff = (data ?? []).filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }));
  }
  const unassigned = clients.filter((c) => !c.assigned_member_id).length;
  const rows: ClientRow[] = clients.map((c) => ({
    company_id: c.company_id,
    company_name: c.company_name,
    business_number: c.business_number ?? null,
    assigned_member_id: c.assigned_member_id,
    assigned_name: c.assigned_name,
    status: status.get(c.company_id) ?? null,
  }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{isAdmin ? "고객사 현황" : "맡은 고객사 현황"}</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">
          {isAdmin
            ? "고객사마다 이 달 마감 상태와 확인할 것을 한눈에 봐요. 여러 곳을 골라 증빙 ZIP을 한 번에 받거나 자료 요청·공지를 한 번에 보낼 수 있어요. 고객사는 연결 링크로 들어오거나, 고객사가 [설정 › 회사 기본정보 › 세무사무소]에 우리 사무소 이메일을 넣으면 늘어나요."
            : "사무소 관리자가 배정한 고객사예요. 이 달 마감 상태와 확인할 것을 보고, 여러 곳을 골라 한 번에 처리할 수 있어요."}
        </p>
      </div>
      {isAdmin && unassigned > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">담당 세무사가 없는 고객사가 {unassigned}곳 있어요.</p>}
      {clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
          <b className="font-semibold text-zinc-900">{mLabel}분 세무 마감</b>
          <span className="text-emerald-700">완료 {closedCount}곳</span>
          <span className="text-amber-800">아직 {clients.length - closedCount}곳</span>
          <span className="ml-auto">
            <MonthPicker months={recentMonths(now)} value={month} base="/tax-office" label="마감 달" />
          </span>
        </div>
      )}
      {clients.length === 0 ? (
        <p className="break-keep rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {isAdmin
            ? "아직 연결된 고객사가 없어요. 고객사가 [설정 › 회사 기본정보 › 세무사무소]에서 우리 사무소를 지정하면 연결 링크가 생겨요. 그 링크로 들어오거나, 고객사에 우리 사무소 이메일로 지정해 달라고 알려 주세요."
            : "아직 맡은 고객사가 없어요. 사무소 관리자에게 배정을 요청해 주세요."}
        </p>
      ) : (
        <OfficeDashboard rows={rows} month={month} isAdmin={isAdmin} staff={staff} />
      )}
    </>
  );
}
