import { Suspense } from "react";
import { Panel } from "@/components/app-admin/app-admin-shell";
import { FormSlotButtons } from "@/components/app-admin/form-slot-buttons";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { formatDateTimeKst } from "@/lib/claims/format";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `양식 칸 신청 · ${BRAND.name} 운영자` };

// 회사 양식 칸 추가 신청(8-104 B-4): 결제가 꺼진 동안 회사 관리자의 [추가 신청]을 받아 칸을 늘려 준다(나중에 1장 2만 원 한 번 결제로)
export default function FormSlotsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const { data } = await admin
    .from("form_slot_requests")
    .select("id, company_id, requested_by_name, status, created_at, done_at, companies(name, extra_form_slots)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const waiting = rows.filter((r) => r.status === "received").length;
  return (
    <>
      <h1 className="text-2xl font-bold">양식 칸 신청</h1>
      <p className="-mt-4 break-keep text-sm text-zinc-600">
        회사 양식 칸(기본 1장)을 다 쓴 회사의 [추가 신청]이에요. 신청 {rows.length}건 · 처리 전 {waiting}건. [+1장 늘려 주기]를 누르면 그 회사 칸이 늘고 신청이 처리돼요.
      </p>
      <Panel title="신청 목록">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">아직 신청이 없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${r.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{r.status === "done" ? "처리됨" : "신청"}</span>
                    {r.companies?.name ?? "(회사 없음)"} · 추가 칸 {r.companies?.extra_form_slots ?? 0}장
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {r.requested_by_name ?? "관리자"} · {formatDateTimeKst(r.created_at)}
                    {r.done_at && ` · 처리 ${formatDateTimeKst(r.done_at)}`}
                  </p>
                </div>
                <FormSlotButtons companyId={r.company_id} extra={r.companies?.extra_form_slots ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
