import { Suspense } from "react";
import { Panel } from "@/components/app-admin/app-admin-shell";
import { StorageRequestButtons } from "@/components/app-admin/storage-request-buttons";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { KIND_LABEL } from "@/lib/billing/storage";
import { formatDateTimeKst } from "@/lib/claims/format";
import { formatWon } from "@/lib/format";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `저장 공간 신청 · ${BRAND.name} 운영자` };

const STATUS: Record<string, [string, string]> = {
  received: ["확인 중", "bg-amber-50 text-amber-800"],
  done: ["처리됨", "bg-emerald-50 text-emerald-700"],
  rejected: ["반려", "bg-zinc-100 text-zinc-700"],
  canceled: ["신청 취소", "bg-zinc-100 text-zinc-500"],
};

// 저장 공간 추가 신청(8-103, D-262): 결제가 꺼진 동안 회사 관리자의 신청을 받아 추가 공간을 켜 준다(결제 붙을 때까지 무료)
export default function StorageRequestsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const { data } = await admin
    .from("storage_requests")
    .select("id, company_id, requested_by_name, kind, storage_gb, monthly_price, status, reject_reason, created_at, done_at, companies(name, extra_storage_gb)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const waiting = rows.filter((r) => r.status === "received").length;
  return (
    <>
      <h1 className="text-2xl font-bold">저장 공간 신청</h1>
      <p className="-mt-4 break-keep text-sm text-zinc-600">
        회사 관리자가 요금제 화면에서 고른 추가 저장 공간이에요. 신청 {rows.length}건 · 확인 중 {waiting}건. [켜기]를 누르면 그 회사 추가 공간이 신청한 크기로 바뀌고(해지는 0GB), 관리자 [알림]방으로 알려요. 결제가 붙을 때까지 무료예요.
      </p>
      <Panel title="신청 목록">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">아직 신청이 없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const [label, cls] = STATUS[r.status] ?? STATUS.received;
              const kind = r.kind as "add" | "change" | "cancel";
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" data-storage-row={r.status}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
                      {r.companies?.name ?? "(회사 없음)"} · {kind === "cancel" ? "추가 공간 해지" : `${r.storage_gb}GB ${KIND_LABEL[kind]}`}
                      {r.monthly_price > 0 && <span className="font-normal text-zinc-500"> (월 {formatWon(r.monthly_price)})</span>}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      지금 추가 공간 {r.companies?.extra_storage_gb ?? 0}GB · {r.requested_by_name ?? "관리자"} · {formatDateTimeKst(r.created_at)}
                      {r.done_at && ` · 처리 ${formatDateTimeKst(r.done_at)}`}
                      {r.reject_reason && ` · 사유: ${r.reject_reason}`}
                    </p>
                  </div>
                  {r.status === "received" && <StorageRequestButtons id={r.id} label={kind === "cancel" ? "해지 처리" : `${r.storage_gb}GB 켜기`} />}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
