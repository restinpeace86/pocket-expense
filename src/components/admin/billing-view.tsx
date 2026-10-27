import { Lock } from "lucide-react";
import { SectionHeading } from "@/components/ui/help";
import type { BillingAddon, BillingPlan, CreditStatus } from "@/lib/admin/billing";
import { checkoutPrice } from "@/lib/billing/checkout";
import { formatWon } from "@/lib/format";
import { EventBonusBanner } from "./event-bonus-banner";
import { SurveyButton } from "./survey-dialog";

// 화면 A-05 요금제 (spec/screens/admin-billing.md). 결제는 무료 제공 기간이라 전부 비활성(D-046), 카드 정보는 받지 않는다.
const DISABLED_TIP = "무료 제공 기간에는 결제할 수 없습니다";

function UsageCard({ s, preview }: { s: CreditStatus; preview: boolean }) {
  const left = Math.max(s.granted - s.used, 0);
  const pct = s.granted > 0 ? Math.min(100, Math.round((s.used / s.granted) * 100)) : 0;
  const empty = left === 0 && !s.eventEnabled;
  const low = !empty && left <= 20;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-600">무료 제공 중</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        영수증 {s.used.toLocaleString("ko-KR")} / {s.granted.toLocaleString("ko-KR")}장 사용
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="무료 영수증 사용량">
        <div className={`h-full rounded-full ${empty ? "bg-red-500" : low ? "bg-amber-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-zinc-700">
        남은 장수 <b className="tabular-nums">{left.toLocaleString("ko-KR")}장</b>
        <span className="text-zinc-500">
          {" "}
          · 기본 {s.freeTrial.toLocaleString("ko-KR")}장{s.eventCount > 0 && ` + 이벤트 추가 지급 ${s.eventCount}회(${s.eventTotal.toLocaleString("ko-KR")}장)`}{s.surveyDone && " + 설문 100장"}
        </span>
      </p>
      {empty ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">무료 사용량을 모두 사용했습니다. 영수증 업로드가 중지되었습니다.</p>
      ) : low ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          무료 사용량이 {left}장 남았습니다.{s.eventEnabled && ` 소진 시 이벤트로 ${s.eventAmount}장이 추가 지급됩니다.`}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-zinc-600">
        현재 한시적 무료 제공 기간입니다.{s.eventEnabled && ` 이벤트 기간에는 무료 영수증을 모두 사용하면 추가 ${s.eventAmount}장을 무료로 더 드립니다.`} 유료 플랜 결제는 준비 중입니다.
      </p>
      {/* 후기·설문 +100장(D-130): 남은 장수가 적거나 없으면 눈에 띄게 */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <SurveyButton done={s.surveyDone} emphasize={empty || low || left === 0} preview={preview} />
      </div>
    </section>
  );
}

// 첫 결제(D-134)면 정가에 줄을 긋고 50% 할인가·부가세 포함 결제 금액을 보여 준다(월간만)
function PlanCard({ plan, firstPurchase }: { plan: BillingPlan; firstPurchase: boolean }) {
  const c = checkoutPrice(plan.monthly_price, firstPurchase);
  return (
    <li className={`relative flex flex-col rounded-xl border bg-white p-5 ${plan.is_featured ? "border-brand-500 ring-1 ring-brand-500" : "border-zinc-200"}`}>
      {plan.is_featured && <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">추천</span>}
      <label className="flex cursor-not-allowed items-center gap-2 text-zinc-400" title={DISABLED_TIP}>
        <input type="radio" disabled className="size-4" aria-label={`${plan.name} 선택`} />
        <span className="text-xs">{plan.recommended_size}</span>
      </label>
      <h3 className="mt-1 text-lg font-semibold">{plan.name}</h3>
      {c.firstPurchase ? (
        <>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">첫 결제 50% 할인</span>
            <s className="text-sm text-zinc-400 tabular-nums">{formatWon(c.list)}</s>
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            <span className="whitespace-nowrap">{formatWon(c.supply)}</span>
            <span className="text-sm font-normal text-zinc-500"> / 첫 달</span>
            <span className="ml-1 text-xs font-normal text-zinc-400">(VAT 별도)</span>
          </p>
          <p className="text-xs text-zinc-500">
            <span className="whitespace-nowrap">첫 달 결제 {formatWon(c.total)}(VAT 포함)</span> · <span className="whitespace-nowrap">다음 달부터 월 {formatWon(c.list)}</span>
          </p>
        </>
      ) : (
        <p className="mt-3 text-2xl font-bold tabular-nums">
          <span className="whitespace-nowrap">{formatWon(plan.monthly_price)}</span>
          <span className="text-sm font-normal text-zinc-500"> / 월</span>
          <span className="ml-1 text-xs font-normal text-zinc-400">(VAT 별도)</span>
        </p>
      )}
      <p className="mt-1 text-sm text-zinc-700">
        영수증 월 {plan.monthly_receipts.toLocaleString("ko-KR")}장 <span className="text-zinc-500">· 장당 약 {formatWon(Math.round(plan.monthly_price / plan.monthly_receipts))}</span>
      </p>
      <span className="mt-auto pt-4" title={DISABLED_TIP}>
        <button type="button" disabled className="min-h-11 w-full cursor-not-allowed rounded-xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-500">
          이 플랜으로 결제하기
        </button>
      </span>
    </li>
  );
}

// 추가 크레딧(애드온, D-133): 기본 장수를 다 썼을 때만 나타난다. 결제 연동 전이라 버튼은 비활성
function AddonCard({ addons }: { addons: BillingAddon[] }) {
  if (!addons.length) return null;
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-5" aria-labelledby="addon-title">
      <h2 id="addon-title" className="font-semibold text-zinc-900">
        추가 크레딧 충전
      </h2>
      <p className="mt-1 text-sm text-zinc-700">남은 영수증을 모두 썼어요. 다음 달까지 기다리지 않고 필요한 만큼 더 쓸 수 있어요.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {addons.map((a) => (
          <li key={a.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p>
              <b>영수증 {a.receipts.toLocaleString("ko-KR")}장</b>
              <span className="ml-2 whitespace-nowrap tabular-nums">{formatWon(a.price)}</span>
              <span className="ml-1 text-xs text-zinc-400">(VAT 별도)</span>
            </p>
            <span title={DISABLED_TIP}>
              <button type="button" disabled className="min-h-11 cursor-not-allowed rounded-xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-500">
                충전하기 (결제 준비 중)
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaymentForm() {
  const input = "min-h-11 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-base text-zinc-400 placeholder:text-zinc-400";
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5" title={DISABLED_TIP}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">결제 수단</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          <Lock className="size-3.5" />
          결제 준비 중
        </span>
      </div>
      {/* 입력 모양만 보여 준다. disabled라 입력·전송이 되지 않고, 이름(name)이 없어 어떤 값도 서버로 가지 않는다 */}
      <fieldset disabled className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-500 sm:col-span-2">
          카드번호
          <input className={input} placeholder="0000-0000-0000-0000" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-zinc-500">
          유효기간
          <input className={input} placeholder="MM / YY" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-zinc-500">
          결제 주기
          <select className={input}>
            <option>월간 자동결제</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-500 sm:col-span-2">
          <input type="checkbox" className="size-4" />
          유료 서비스 이용약관 및 자동결제에 동의합니다
        </label>
      </fieldset>
    </section>
  );
}

export function BillingView({ status, plans, addons = [], preview = false }: { status: CreditStatus; plans: BillingPlan[]; addons?: BillingAddon[]; preview?: boolean }) {
  const exhausted = status.granted - status.used <= 0;
  return (
    <>
      {status.showEventBanner && <EventBonusBanner amount={status.eventAmount} count={status.eventCount} total={status.eventTotal} preview={preview} />}
      <SectionHeading
        as="h1"
        title="요금제"
        summary="영수증 장수 기준 월 구독입니다. 지금은 무료 제공 기간이라 결제하지 않고 쓰실 수 있어요."
        helpId="billing"
        help={
          <>
            <p>영수증 사진·파일 1장을 올릴 때마다 1장이 빠집니다. 같은 항목의 사진 교체·영수증 없는 항목은 빠지지 않고, 지워도 돌려받지 않습니다.</p>
            <p>가격은 공급가액이며 결제 시 부가세 10%가 더해지고 세금계산서가 발행됩니다. 예: 스탠다드 49,000원 + 부가세 4,900원 = 53,900원.</p>
            <p>매월 제공되는 기본 장수 중 남은 장수는 다음 달로 넘어가지 않아요. 다 쓰면 그때만 추가 크레딧(50장 8,000원)을 살 수 있어요.</p>
          </>
        }
      />
      <UsageCard s={status} preview={preview} />
      {exhausted && <AddonCard addons={addons} />}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">정식 플랜</h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.code} plan={p} firstPurchase={status.firstPurchase} />
          ))}
        </ul>
        <p className="text-sm text-zinc-500">※ 매월 제공되는 기본 크레딧 중 사용하지 않은 잔여 장수는 다음 달로 이월되지 않습니다.</p>
      </section>
      <PaymentForm />
    </>
  );
}
