"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { requestStorageAction } from "@/app/workspace/[id]/admin/billing/actions";
import { monthlyTotal, requestLabel, type StorageAddon } from "@/lib/billing/storage";
import { formatWon } from "@/lib/format";

// 요금제 카드의 [저장 공간 추가](8-103, D-262): 하나만 체크(다시 누르면 해제) → 가격에 더해 보여 줌.
// 랜딩 가격표와 관리자 요금제가 같이 쓴다. 카드마다 따로 고른다
type Ctx = { addons: StorageAddon[]; gb: number; setGb: (gb: number) => void; base: number };
const PlanStorageCtx = createContext<Ctx | null>(null);
const use = () => {
  const c = useContext(PlanStorageCtx);
  if (!c) throw new Error("PlanStorage 안에서 써야 해요");
  return c;
};

export function PlanStorage({ addons, base, initial = 0, children }: { addons: StorageAddon[]; base: number; initial?: number; children: ReactNode }) {
  const [gb, setGb] = useState(initial);
  return <PlanStorageCtx.Provider value={{ addons, gb, setGb, base }}>{children}</PlanStorageCtx.Provider>;
}

// 큰 가격(랜딩): 고르면 합계, 아래에 "29,000원 + 공간 10GB 10,000원"
export function PlanStoragePrice({ className, unitClass, vatClass }: { className: string; unitClass: string; vatClass: string }) {
  const { addons, gb, base } = use();
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

// 상품 칸 2×2 — 하나만, 다시 누르면 해제
export function PlanStorageChips({ planName }: { planName: string }) {
  const { addons, gb, setGb } = use();
  if (!addons.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-600">저장 공간 추가 (선택)</span>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={`${planName} 저장 공간 추가`}>
        {addons.map((a) => {
          const on = gb === a.storage_gb;
          return (
            <button
              key={a.code}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => setGb(on ? 0 : a.storage_gb)}
              className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-2 text-left text-[13px] tabular-nums ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-900" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
              data-storage-chip={a.storage_gb}
            >
              <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-400"}`} aria-hidden>
                {on && "✓"}
              </span>
              <span className="min-w-0">
                {a.storage_gb}GB <span className="whitespace-nowrap">+{formatWon(a.monthly_price)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="text-xs text-zinc-500">채팅 사진·파일과 파일 보관함이 함께 써요</span>
    </div>
  );
}

// 관리자: 매월 결제 금액 줄
export function PlanStorageTotal() {
  const { addons, gb, base } = use();
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

// 관리자: 결제 버튼(결제 준비 중) + 지금 신청(결제 붙을 때까지 무료, 운영자가 켜 줌)
export function PlanStorageActions({ current, pending, tip }: { current: number; pending: boolean; tip: string }) {
  const { addons, gb, base } = use();
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
    <div className="mt-auto flex flex-col gap-2 pt-4">
      <span title={tip}>
        <button type="button" disabled className="min-h-11 w-full cursor-not-allowed rounded-xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-500">
          {formatWon(monthlyTotal(base, addons, gb))} 결제하기 (결제 준비 중)
        </button>
      </span>
      {label && (
        <button type="button" onClick={request} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-600 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60" data-storage-request>
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
