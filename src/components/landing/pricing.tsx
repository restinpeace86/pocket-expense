import { Check } from "lucide-react";
import { planCompareRows, planCore, PRICING_RULES } from "@/lib/billing/plan-benefits";
import { FEATURE_GROUPS } from "@/lib/landing/features";
import { createPublicClient } from "@/lib/supabase/public";
import { PlanChoice, PlanStorage, PlanSummary, StorageAddonPicker } from "@/components/billing/plan-storage";
import { formatWon } from "@/lib/format";

const START_HREF = `/login?next=${encodeURIComponent("/onboarding/create-company")}`;
import type { StorageAddon } from "@/lib/billing/storage";

type Plan = {
  code: string;
  name: string;
  monthly_price: number;
  monthly_receipts: number;
  recommended_size: string | null;
  is_unlimited: boolean;
  is_featured: boolean;
  max_members: number | null;
  chat_storage_mb: number | null;
  vault_storage_mb: number | null;
  storage_mb: number | null;
  form_slots: number;
  form_slots_unlimited: boolean;
  budget_alerts: boolean;
  support_label: string | null;
};

// 요금제는 billing_plans에서 읽는다(하드코딩 금지). 공용 데이터라 정적으로 캐시한다. (D-046, D-054, D-133)
// D-198: 영수증 장수만이 아니라 "이 가격에 받는 혜택" — 직원 수(1인당 가격)·AI 영수증 읽기·모든 기능, 카드 아래 모든 플랜 공통 기능
// D-262: 카드마다 [저장 공간 추가] 체크(하나만) → 큰 가격이 요금제 + 추가 공간 합계로
export async function Pricing() {
  "use cache";
  let plans: Plan[] = [];
  let storageAddons: StorageAddon[] = [];
  try {
    const db = createPublicClient();
    const [{ data }, { data: sa }] = await Promise.all([
      db
        .from("billing_plans")
        .select("code, name, monthly_price, monthly_receipts, recommended_size, is_unlimited, is_featured, max_members, chat_storage_mb, vault_storage_mb, monthly_doc_converts, doc_converts_unlimited, trash_days, storage_mb, form_slots, form_slots_unlimited, budget_alerts, support_label")
        .order("sort_order"),
      db.from("storage_addons").select("code, storage_gb, monthly_price").order("sort_order"),
    ]);
    plans = data ?? [];
    storageAddons = sa ?? [];
  } catch {
    plans = [];
  }
  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 text-zinc-900">
      <div className="text-center">
        <span className="inline-block text-balance rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
          지금 가입하면 첫 월말 마감까지 무료
        </span>
        {/* D-273: 박히는 한 줄 + 뒷받침 한 줄 */}
        <h2 className="mt-4 text-balance break-keep text-[2rem] font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-[2.6rem]">
          기능은 전부, 인원은 무제한.
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">규모만 고르세요.</span>
        </h2>
        <p className="mt-3 text-balance break-keep text-lg text-zinc-600">직원이 늘어도 요금은 그대로. 도입비 0원.</p>
      </div>
      {/* D-272: 카드 하나 고르기 + 저장 공간 체크 → 아래 [선택한 구성]에 합계(카드 가격은 그대로) */}
      <PlanStorage addons={storageAddons} plans={plans.map((p) => ({ code: p.code, name: p.name, price: p.monthly_price }))} initialPlan={(plans.find((p) => p.is_featured) ?? plans[0]).code}>
      <ul className="mx-auto mt-10 grid max-w-md gap-4 md:max-w-none md:grid-cols-3" role="radiogroup" aria-label="플랜 고르기">
        {plans.map((plan) => (
          <PlanChoice
            key={plan.code}
            code={plan.code}
            name={plan.name}
            className={`relative flex flex-col rounded-2xl border-2 p-6 backdrop-blur transition ${plan.is_featured ? "border-emerald-300 bg-emerald-50/60 shadow-md" : "border-zinc-200 bg-white shadow-sm"}`}
            selectedClass="!border-brand-600 ring-2 ring-brand-600/20"
          >
            {plan.is_featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">추천</span>
            )}
            <p className="break-keep text-sm text-zinc-500">{plan.recommended_size}</p>
            <h3 className="mt-1 text-xl font-semibold text-zinc-900">{plan.name}</h3>
            <p className="mt-4 whitespace-nowrap text-3xl font-bold tabular-nums text-zinc-900" data-plan-price={plan.monthly_price}>
              {formatWon(plan.monthly_price)}
              <span className="text-base font-normal text-zinc-500"> / 월</span>
              <span className="ml-1 text-xs font-normal text-zinc-500">(VAT 별도)</span>
            </p>
            <p className="mt-5 text-xs font-medium text-zinc-500">이 가격에 포함</p>
            <ul className="mt-2 flex flex-col gap-2.5">
              {planCore(plan).map((b) => (
                <li key={b.label} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0">
                    <span className="block break-keep text-zinc-800">{b.label}</span>
                    {b.sub && <span className="block break-keep text-sm text-zinc-500">{b.sub}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </PlanChoice>
        ))}
      </ul>
      <div className="mx-auto mt-4 grid max-w-md gap-4 md:max-w-none md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StorageAddonPicker />
        <PlanSummary startHref={START_HREF} />
      </div>
      </PlanStorage>
      {/* [플랜 자세히 비교](D-273): 카드엔 핵심 줄만, 나머지는 펼쳐서 */}
      <details className="group mx-auto mt-6 max-w-4xl rounded-2xl border border-zinc-200 bg-white" data-plan-compare>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-1.5 px-4 font-semibold text-indigo-700 [&::-webkit-details-marker]:hidden">
          플랜 자세히 비교 <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="overflow-x-auto border-t border-zinc-100 px-2 pb-3">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="px-2 py-2 font-semibold">항목</th>
                {plans.map((p) => (
                  <th key={p.code} className="px-2 py-2 font-semibold">
                    {p.name} <span className="font-normal tabular-nums">{formatWon(p.monthly_price)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planCompareRows(plans).map((r) => (
                <tr key={r.label} className="border-t border-zinc-100">
                  <td className="px-2 py-2 text-zinc-600">{r.label}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className="break-keep px-2 py-2 font-medium text-zinc-900">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {/* 모든 플랜 기본 기능(D-273) — 랜딩 [기능] 벽과 같은 목록 */}
      <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5" data-common-features>
        <p className="text-center font-bold text-zinc-900">모든 플랜 기본 기능</p>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-5">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.key}>
              <p className="text-sm font-bold text-zinc-900">{g.title}</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {g.items.map((t) => (
                  <li key={t} className="flex gap-1.5 text-[13px] text-zinc-700">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span className="break-keep">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {/* 요금 기준(D-199) — 접어 둠(D-273) */}
      <details className="group mx-auto mt-4 max-w-4xl px-1" data-pricing-rules>
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
          요금 기준 보기 <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {PRICING_RULES.map((r) => (
            <li key={r} className="break-keep text-sm text-zinc-500">
              · {r}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
