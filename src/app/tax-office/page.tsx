import { Building2, CheckCircle2, ChevronRight, Clock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AssignSelect } from "@/components/tax-office/assign-select";
import { ReleaseClientButton } from "@/components/tax-office/office-actions";
import { createClient } from "@/lib/supabase/server";
import { getMyTaxOffice, getTaxOfficeClients, isActiveMember } from "@/lib/tax-office/queries";
import { currentMonthKst } from "@/lib/dates";

// 세무사무소 첫 화면: 고객사 목록 (D-149). 관리자는 담당 세무사를 배정하고, 세무사는 맡은 고객사만 본다.
// D-193: 고객사마다 지난달(지금 마감하는 달) 회사 세무 마감 상태 + 자료 요청 답변 대기·답변 옴
export default function TaxOfficeHome() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Clients />
    </Suspense>
  );
}

const bizNo = (v: string) => (/^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v);

type ClientStatus = { company_id: string; closed: boolean; closed_at: string | null; requests_open: number; requests_answered: number; unread: number };

function prevMonth(now: string): string {
  const [y, m] = now.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function Clients() {
  const supabase0 = await createClient(); // 쿠키를 먼저 읽어 이 화면을 요청 때 그리게(현재 달 계산이 미리 그리기에 걸리지 않게)
  const month = prevMonth(currentMonthKst());
  const [state, clients, { data: statusData }] = await Promise.all([getMyTaxOffice(), getTaxOfficeClients(), supabase0.rpc("tax_office_client_status", { p_month: month })]);
  const status = new Map(((statusData ?? []) as unknown as ClientStatus[]).map((x) => [x.company_id, x]));
  const mLabel = `${Number(month.slice(5))}월`;
  const closedCount = clients.filter((c) => status.get(c.company_id)?.closed).length;
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
            ? "고객사가 보낸 연결 링크로 들어오거나, 고객사가 [설정 › 회사 기본정보 › 세무사무소]에 우리 사무소 이메일을 넣으면 자동으로 늘어나요. 담당 세무사를 배정하면 그 세무사도 볼 수 있어요. 계약하지 않은 회사라면 [고객사 해제]로 빼 주세요."
            : "사무소 관리자가 배정한 고객사예요. 회사를 고르면 승인된 지출과 세무용 엑셀을 볼 수 있어요."}
        </p>
      </div>
      {isAdmin && unassigned > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">담당 세무사가 없는 고객사가 {unassigned}곳 있어요.</p>
      )}
      {clients.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
          <b className="font-semibold text-zinc-900">{mLabel}분 세무 마감</b>
          <span className="text-emerald-700">완료 {closedCount}곳</span>
          <span className="text-amber-800">아직 {clients.length - closedCount}곳</span>
        </p>
      )}
      {clients.length === 0 ? (
        <p className="break-keep rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {isAdmin ? "아직 연결된 고객사가 없어요. 고객사가 [설정 › 회사 기본정보 › 세무사무소]에서 우리 사무소를 지정하면 연결 링크가 생겨요. 그 링크로 들어오거나, 고객사에 우리 사무소 이메일로 지정해 달라고 알려 주세요." : "아직 맡은 고객사가 없어요. 사무소 관리자에게 배정을 요청해 주세요."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {clients.map((c) => (
            <li key={c.company_id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <Link href={`/tax-office/${c.company_id}?month=${month}`} className="flex min-h-12 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Building2 className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-zinc-900">{c.company_name}</span>
                  <span className="block text-xs text-zinc-500">{bizNo(c.business_number)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
              </Link>
              <ClientBadges s={status.get(c.company_id)} mLabel={mLabel} />
              {isAdmin && (
                <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3">
                  <AssignSelect companyId={c.company_id} companyName={c.company_name} value={c.assigned_member_id} staff={staff} />
                  {c.agent_name && !c.assigned_member_id && (
                    <p className="break-all text-xs text-zinc-500">
                      고객사가 적은 담당: {c.agent_name}
                      {c.agent_email && ` (${c.agent_email})`}
                    </p>
                  )}
                  <ReleaseClientButton companyId={c.company_id} companyName={c.company_name} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// 고객사 카드의 달별 상태(D-193): 마감 완료(날짜)/마감 전 + 자료 요청 회사 답변 대기·답변 옴
function ClientBadges({ s, mLabel }: { s: ClientStatus | undefined; mLabel: string }) {
  const chip = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";
  const md = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });
  return (
    <div className="flex flex-wrap gap-1.5">
      {s?.closed ? (
        <span className={`${chip} bg-emerald-50 text-emerald-700`}>
          <CheckCircle2 className="size-3.5" aria-hidden />
          {mLabel} 마감 완료{s.closed_at ? ` · ${md(s.closed_at)}` : ""}
        </span>
      ) : (
        <span className={`${chip} bg-amber-50 text-amber-800`}>
          <Clock className="size-3.5" aria-hidden />
          {mLabel} 마감 전
        </span>
      )}
      {(s?.unread ?? 0) > 0 && (
        <span className={`${chip} bg-red-600 text-white`}>
          <MessageSquare className="size-3.5" aria-hidden />
          새 확인 요청 {s?.unread}
        </span>
      )}
      {(s?.requests_answered ?? 0) > 0 && (
        <span className={`${chip} bg-brand-50 text-brand-700`}>
          <MessageSquare className="size-3.5" aria-hidden />
          답변 옴 {s?.requests_answered}
        </span>
      )}
      {(s?.requests_open ?? 0) > 0 && (
        <span className={`${chip} bg-zinc-100 text-zinc-600`}>
          <MessageSquare className="size-3.5" aria-hidden />
          답변 대기 {s?.requests_open}
        </span>
      )}
    </div>
  );
}
