import { Check, Lock } from "lucide-react";
import { SectionHeading } from "@/components/ui/help";
import type { BillingAddon, BillingPlan, CreditStatus } from "@/lib/admin/billing";
import { checkoutPrice } from "@/lib/billing/checkout";
import { COMMON_FEATURES, planBenefits, PRICING_RULES } from "@/lib/billing/plan-benefits";
import { formatWon } from "@/lib/format";
import { todayKst } from "@/lib/dates";
import { EventBonusBanner } from "./event-bonus-banner";
import { SurveyButton } from "./survey-dialog";

// 화면 A-05 요금제 (spec/screens/admin-billing.md). 결제는 무료 제공 기간이라 전부 비활성(D-046), 카드 정보는 받지 않는다.
const DISABLED_TIP = "무료 제공 기간에는 결제할 수 없습니다";

// 무료 이용(D-201): 장수가 아니라 기간 — 가입한 달 + 다음 달 세무 마감일까지(첫 월말 마감을 해 보게). 장수는 안전 상한
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
function UsageCard({ s, preview, today }: { s: CreditStatus; preview: boolean; today: string }) {
  const left = Math.max(s.granted - s.used, 0);
  const empty = left === 0 && !s.eventEnabled;
  const low = !empty && left <= 20;
  const ended = !!s.trialEndsOn && s.trialEndsOn < today;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-600">무료 이용 중</p>
      <p className="mt-1 text-2xl font-bold">
        {s.trialEndsOn ? (ended ? "무료 기간이 끝났어요" : `${md(s.trialEndsOn)}까지 무료`) : "무료 이용 중"}
      </p>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        {ended
          ? "지금은 결제 준비 중이라 그대로 계속 무료로 쓸 수 있어요. 결제가 열리면 미리 알려 드릴게요."
          : "첫 월말 마감(세무사무소 전달)까지 모든 기능을 써 보세요. 결제 정보는 필요 없어요."}
      </p>
      <p className="mt-3 text-sm text-zinc-700">
        쓴 크레딧(영수증·서류 변환) <b className="tabular-nums">{s.used.toLocaleString("ko-KR")}</b>
        <span className="text-zinc-500"> · 무료 기간 안전 상한 {s.granted.toLocaleString("ko-KR")}장</span>
      </p>
      {empty ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">무료 기간 안전 상한을 모두 사용했습니다. 영수증 업로드가 중지되었습니다.</p>
      ) : low ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          안전 상한까지 {left}장 남았습니다.{s.eventEnabled && ` 다 쓰면 이벤트로 ${s.eventAmount}장이 추가 지급됩니다.`}
        </p>
      ) : null}
      {/* 후기 = 첫 결제 50% 할인 쿠폰(D-201). 무료 기간이 3일 안으로 남았거나 끝났으면 눈에 띄게 */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <SurveyButton done={s.surveyDone} emphasize={ended || (!!s.trialEndsOn && daysBetween(today, s.trialEndsOn) <= 3)} preview={preview} />
      </div>
    </section>
  );
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// 후기 쿠폰(D-201)이 있으면 정가에 줄을 긋고 50% 할인가·부가세 포함 결제 금액을 보여 준다(월간만). 없으면 정가 + 쿠폰 안내
function PlanCard({ plan, coupon }: { plan: BillingPlan; coupon: boolean }) {
  const c = checkoutPrice(plan.monthly_price, coupon);
  return (
    <li className={`relative flex flex-col rounded-xl border bg-white p-5 ${plan.is_featured ? "border-brand-500 ring-1 ring-brand-500" : "border-zinc-200"}`}>
      {plan.is_featured && <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">추천</span>}
      <label className="flex cursor-not-allowed items-center gap-2 text-zinc-400" title={DISABLED_TIP}>
        <input type="radio" disabled className="size-4" aria-label={`${plan.name} 선택`} />
        <span className="text-xs">{plan.recommended_size}</span>
      </label>
      <h3 className="mt-1 text-lg font-semibold">{plan.name}</h3>
      {c.coupon ? (
        <>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">후기 쿠폰 · 첫 결제 50% 할인</span>
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
      {!c.coupon && <p className="mt-1 break-keep text-xs text-rose-600">후기를 남기면 첫 결제 50% 할인 쿠폰을 드려요</p>}
      {/* 이 가격에 포함(D-198): 직원 수·AI 영수증 읽기·모든 기능 */}
      <p className="mt-4 text-xs font-medium text-zinc-500">이 가격에 포함</p>
      <ul className="mt-1.5 flex flex-col gap-2">
        {planBenefits(plan).map((b) => (
          <li key={b.label} className="flex gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <span className="min-w-0">
              <span className="block break-keep text-zinc-900">{b.label}</span>
              {b.sub && <span className="block break-keep text-xs text-zinc-500">{b.sub}</span>}
            </span>
          </li>
        ))}
      </ul>
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

export function BillingView({ status, plans, addons = [], preview = false, today = todayKst() }: { status: CreditStatus; plans: BillingPlan[]; addons?: BillingAddon[]; preview?: boolean; today?: string }) {
  const exhausted = status.granted - status.used <= 0;
  return (
    <>
      {status.showEventBanner && <EventBonusBanner amount={status.eventAmount} count={status.eventCount} total={status.eventTotal} preview={preview} />}
      <SectionHeading
        as="h1"
        title="요금제"
        summary="모든 기능이 포함된 월 구독이에요. 직원 수와 AI 영수증 읽기 장수로 플랜을 골라요. 지금은 첫 월말 마감까지 무료 이용 기간이라 결제하지 않고 쓰실 수 있어요."
        helpId="billing"
        help={
          <>
            <p>영수증 사진·파일 1장을 올릴 때마다 1장이 빠집니다. 같은 항목의 사진 교체·영수증 없는 항목은 빠지지 않고, 지워도 돌려받지 않습니다.</p>
            <p>가격은 공급가액이며 결제 시 부가세 10%가 더해지고 세금계산서가 발행됩니다. 예: 프로 49,000원 + 부가세 4,900원 = 53,900원.</p>
            <p>매월 제공되는 기본 장수 중 남은 장수는 다음 달로 넘어가지 않아요. 다 쓰면 그때만 추가 크레딧(50장 8,000원)을 살 수 있어요.</p>
          </>
        }
      />
      <UsageCard s={status} preview={preview} today={today} />
      {exhausted && <AddonCard addons={addons} />}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">정식 플랜</h2>
        <p className="-mt-1 break-keep text-sm text-zinc-600">모든 기능은 모든 플랜에 같아요. 직원 수와 AI 영수증 읽기 장수로 팀 규모에 맞춰 고르세요.</p>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.code} plan={p} coupon={status.coupon} />
          ))}
        </ul>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-semibold">모든 플랜에 똑같이 포함</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {COMMON_FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-zinc-700">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <span className="break-keep">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* 요금 기준(D-199) */}
        <div>
          <p className="text-sm font-semibold">요금 기준</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {PRICING_RULES.map((r) => (
              <li key={r} className="break-keep text-sm text-zinc-600">
                · {r}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <PaymentForm />
    </>
  );
}
