"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { requestStorageAction } from "@/app/workspace/[id]/admin/billing/actions";
import { monthlyTotal, requestLabel, type StorageAddon } from "@/lib/billing/storage";
import { formatWon } from "@/lib/format";

// [저장 공간 추가](8-103, D-262 → D-270): 카드 밖 한 영역에서 하나만 고르면(다시 누르면 해제) 모든 요금제 카드 가격이 합계로 바뀐다.
// 랜딩 가격표와 관리자 요금제가 같이 쓴다
type Ctx = { addons: StorageAddon[]; gb: number; setGb: (gb: number) => void };
const PlanStorageCtx = createContext<Ctx | null>(null);
const use = () => {
  const c = useContext(PlanStorageCtx);
  if (!c) throw new Error("PlanStorage 안에서 써야 해요");
  return c;
};

export function PlanStorage({ addons, initial = 0, children }: { addons: StorageAddon[]; initial?: number; children: ReactNode }) {
  const [gb, setGb] = useState(initial);
  return <PlanStorageCtx.Provider value={{ addons, gb, setGb }}>{children}</PlanStorageCtx.Provider>;
}

// 큰 가격: 고르면 합계, 아래에 "29,000원 + 공간 10GB 10,000원"
export function PlanStoragePrice({ base, className, unitClass, vatClass }: { base: number; className: string; unitClass: string; vatClass: string }) {
  const { addons, gb } = use();
  const total = monthlyTotal(base, addons, gb);
  return (
    <>
      <p className={className} data-plan-total={total}>
        {formatWon(total)}
        <span className={unitClass}> / 월</span>
        <span className={vatClass}>(VAT 별도)</span>
      </p>
      {gb > 0 && (
        <p className="mt-0.5 text-xs tabular-nums text-zinc-500" data-plan-calc>
          {formatWon(base)} + 공간 {gb}GB {formatWon(total - base)}
        </p>
      )}
    </>
  );
}

// 저장 공간 추가 영역(카드 밖 하나) — 하나만, 다시 누르면 해제. children = 관리자 [지금 신청]
export function StorageAddonPicker({ note, children }: { note?: string; children?: ReactNode }) {
  const { addons, gb, setGb } = use();
  if (!addons.length) return null;
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5" aria-labelledby="storage-addon-title" data-storage-picker>
      <h3 id="storage-addon-title" className="font-semibold text-zinc-900">
        저장 공간 추가 <span className="text-sm font-normal text-zinc-500">(선택)</span>
      </h3>
      <p className="mt-1 break-keep text-sm text-zinc-600">{note ?? "모든 플랜에 같은 가격으로 더할 수 있어요. 고르면 위 카드 가격이 합계로 바뀌어요. 다시 누르면 해제돼요."}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-label="저장 공간 추가">
        {addons.map((a) => {
          const on = gb === a.storage_gb;
          return (
            <button
              key={a.code}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => setGb(on ? 0 : a.storage_gb)}
              className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left tabular-nums ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-900" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`}
              data-storage-chip={a.storage_gb}
            >
              <span className={`flex size-4 shrink-0 items-center justify-center rounded border text-[11px] ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-400"}`} aria-hidden>
                {on && "✓"}
              </span>
              <span className="min-w-0">
                <b className="block text-sm">+{a.storage_gb}GB</b>
                <span className="block text-xs text-zinc-600">월 {formatWon(a.monthly_price)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {children}
    </section>
  );
}

// 관리자: 카드의 매월 결제 금액 줄
export function PlanStorageTotal({ base }: { base: number }) {
  const { addons, gb } = use();
  const total = monthlyTotal(base, addons, gb);
  return (
    <p className="mt-3 flex items-baseline justify-between gap-2 text-sm" data-month-total={total}>
      <span className="text-zinc-600">매월 결제 금액</span>
      <b className="tabular-nums">
        {formatWon(total)} <span className="text-xs font-normal text-zinc-500">VAT 별도</span>
      </b>
    </p>
  );
}

// 관리자: 카드의 결제 버튼(결제 준비 중 — 결제가 붙을 때까지 막힘)
export function PlanPayButton({ base, tip }: { base: number; tip: string }) {
  const { addons, gb } = use();
  return (
    <span title={tip} className="mt-auto block pt-4">
      <button type="button" disabled className="min-h-11 w-full cursor-not-allowed rounded-xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-500">
        {formatWon(monthlyTotal(base, addons, gb))} 결제하기 (결제 준비 중)
      </button>
    </span>
  );
}

// 관리자: 저장 공간 [지금 신청]/[바꾸기]/[해지 신청](결제 붙을 때까지 무료, 운영자가 켜 줌)
export function StorageRequestButton({ current, pending }: { current: number; pending: boolean }) {
  const { gb } = use();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const label = pending ? null : requestLabel(current, gb);
  const request = () =>
    start(async () => {
      setMsg(null);
      const r = await requestStorageAction(gb);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: "신청했어요. 운영자가 확인하고 켜 드려요(보통 1영업일). 결제가 열릴 때까지는 무료예요." });
      router.refresh();
    });
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      {label && (
        <button type="button" onClick={request} disabled={busy} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-600 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60" data-storage-request>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {label}
        </button>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
