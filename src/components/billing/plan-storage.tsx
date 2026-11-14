"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { requestStorageAction as requestStorageActionRaw } from "@/app/workspace/[id]/admin/billing/actions";
import { addonPrice, requestLabel, type StorageAddon } from "@/lib/billing/storage";
import { formatWon } from "@/lib/format";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const requestStorageAction = guarded(requestStorageActionRaw);

// 요금 고르기(D-262 → D-270 → D-272): 플랜 카드 하나 고르기 + [저장 공간 추가] 체크(하나만) → 아래 [선택한 구성]에
// "플랜 가격 + 저장 공간 가격 = 합계". 카드 가격은 바뀌지 않는다. 결제는 [선택한 구성]에서(지금은 결제 준비 중).
// 랜딩 가격표와 관리자 요금제가 같이 쓴다
export type PlanOption = { code: string; name: string; price: number };
type Ctx = { addons: StorageAddon[]; plans: PlanOption[]; plan: string; setPlan: (c: string) => void; gb: number; setGb: (gb: number) => void };
const PlanStorageCtx = createContext<Ctx | null>(null);
const use = () => {
  const c = useContext(PlanStorageCtx);
  if (!c) throw new Error("PlanStorage 안에서 써야 해요");
  return c;
};

export function PlanStorage({ addons, plans, initialPlan, initial = 0, children }: { addons: StorageAddon[]; plans: PlanOption[]; initialPlan: string; initial?: number; children: ReactNode }) {
  const [gb, setGb] = useState(initial);
  const [plan, setPlan] = useState(initialPlan);
  return <PlanStorageCtx.Provider value={{ addons, plans, plan, setPlan, gb, setGb }}>{children}</PlanStorageCtx.Provider>;
}

// 플랜 카드(고를 수 있음): 카드 아무 데나 누르면 그 플랜. 맨 위 동그라미 + 테두리로 표시
export function PlanChoice({ code, name, className, selectedClass, children }: { code: string; name: string; className: string; selectedClass: string; children: ReactNode }) {
  const { plan, setPlan } = use();
  const on = plan === code;
  return (
    <li className={`${className} ${on ? selectedClass : ""} cursor-pointer`} onClick={() => setPlan(code)} data-plan={code} data-plan-selected={on}>
      <button type="button" role="radio" aria-checked={on} onClick={() => setPlan(code)} className="mb-2 flex min-h-9 items-center gap-2 self-start rounded-full text-sm font-semibold text-zinc-700" data-plan-pick={code}>
        <span className={`flex size-5 items-center justify-center rounded-full border-2 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-400 bg-white"}`} aria-hidden>
          {on && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        {on ? `${name} 선택됨` : `${name} 고르기`}
      </button>
      {children}
    </li>
  );
}

// 저장 공간 추가 영역(카드 밖 하나) — 체크 하나만, 다시 누르면 해제
export function StorageAddonPicker({ note }: { note?: string }) {
  const { addons, gb, setGb } = use();
  if (!addons.length) return null;
  return (
    // 오른쪽 [선택한 구성]과 높이를 맞춘다(D-275): 상자는 칸 높이만큼 늘고, 남는 높이는 체크 칸이 나눠 채운다
    <section className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5" aria-labelledby="storage-addon-title" data-storage-picker>
      <h3 id="storage-addon-title" className="font-semibold text-zinc-900">
        저장 공간 추가 <span className="text-sm font-normal text-zinc-500">(선택)</span>
      </h3>
      <p className="mt-1 break-keep text-sm text-zinc-600">{note ?? "모든 플랜에 같은 가격으로 더할 수 있어요. 체크하면 아래 합계에 더해져요. 다시 누르면 해제돼요."}</p>
      <div className="mt-3 grid flex-1 auto-rows-fr grid-cols-2 gap-2" role="group" aria-label="저장 공간 추가">
        {addons.map((a) => {
          const on = gb === a.storage_gb;
          return (
            <button
              key={a.code}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => setGb(on ? 0 : a.storage_gb)}
              className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left tabular-nums ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-900" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`}
              data-storage-chip={a.storage_gb}
            >
              <span className={`flex size-4 shrink-0 items-center justify-center rounded border text-[11px] ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-400"}`} aria-hidden>
                {on && "✓"}
              </span>
              <span className="min-w-0">
                <b className="block text-base">+{a.storage_gb}GB</b>
                <span className="block text-sm text-zinc-600">월 {formatWon(a.monthly_price)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// [선택한 구성]: 플랜 + 저장 공간 = 합계. 버튼 자리 — 랜딩(startHref): 이 구성으로 무료로 시작, 관리자(payTip): 결제하기(준비 중).
// 결제가 붙으면 관리자 버튼을 여기서 켠다
export function PlanSummary({ startHref, payTip, children }: { startHref?: string; payTip?: string; children?: ReactNode }) {
  const { addons, plans, plan, gb } = use();
  const p = plans.find((x) => x.code === plan) ?? plans[0];
  if (!p) return null;
  const extra = addonPrice(addons, gb);
  const total = p.price + extra;
  return (
    <section className="rounded-2xl border-2 border-brand-200 bg-brand-50/50 p-4 md:p-5" aria-labelledby="plan-summary-title" data-plan-summary>
      <h3 id="plan-summary-title" className="font-semibold text-zinc-900">
        선택한 구성
      </h3>
      <dl className="mt-3 flex flex-col gap-1.5 text-sm tabular-nums">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-700">{p.name} 플랜</dt>
          <dd className="text-zinc-900" data-summary-plan={p.price}>
            {formatWon(p.price)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-700">저장 공간 추가</dt>
          <dd className="text-zinc-900" data-summary-storage={extra}>
            {gb ? `+${gb}GB ${formatWon(extra)}` : "없음"}
          </dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-brand-200 pt-2">
          <dt className="font-semibold text-zinc-900">매월 합계</dt>
          <dd className="text-xl font-bold text-zinc-900" data-summary-total={total}>
            {formatWon(total)} <span className="text-xs font-normal text-zinc-500">/ 월 (VAT 별도)</span>
          </dd>
        </div>
      </dl>
      <div className="mt-4">{startHref ? <SummaryStartLink href={startHref} total={total} planName={p.name} /> : <SummaryPayButton total={total} tip={payTip ?? ""} />}</div>
      {children}
    </section>
  );
}

// 랜딩: [이 구성으로 무료로 시작하기] — 결제 정보 없이 시작(첫 월말 마감까지 무료)
function SummaryStartLink({ href, total, planName }: { href: string; total: number; planName: string }) {
  return (
    <>
      <Link href={href} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500" data-summary-start>
        이 구성으로 무료로 시작하기
      </Link>
      <p className="mt-2 break-keep text-center text-xs text-zinc-600">
        첫 월말 마감까지 무료예요. 무료 기간 뒤 {planName} {formatWon(total)}/월(VAT 별도) — 결제 정보는 지금 필요 없어요.
      </p>
    </>
  );
}

// 관리자: 결제 버튼(결제 준비 중 — 결제가 붙으면 여기서 결제)
function SummaryPayButton({ total, tip }: { total: number; tip: string }) {
  return (
    <span title={tip} className="block">
      <button type="button" disabled className="min-h-12 w-full cursor-not-allowed rounded-xl bg-zinc-200 px-4 font-semibold text-zinc-500" data-summary-pay>
        {formatWon(total)} 결제하기 (결제 준비 중)
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
  if (!label && !msg) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-brand-200 pt-3">
      <p className="break-keep text-xs text-zinc-600">결제가 열리기 전에는 저장 공간만 먼저 신청할 수 있어요(무료로 켜 드려요).</p>
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
