import { Check } from "lucide-react";
import { formatWon } from "@/lib/format";
import { COMMON_FEATURES, planBenefits, PRICING_RULES } from "@/lib/billing/plan-benefits";
import { createPublicClient } from "@/lib/supabase/public";

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
};

// 요금제는 billing_plans에서 읽는다(하드코딩 금지). 공용 데이터라 정적으로 캐시한다. (D-046, D-054, D-133)
// D-198: 영수증 장수만이 아니라 "이 가격에 받는 혜택" — 직원 수(1인당 가격)·AI 영수증 읽기·모든 기능, 카드 아래 모든 플랜 공통 기능
export async function Pricing() {
  "use cache";
  let plans: Plan[] = [];
  try {
    const { data } = await createPublicClient()
      .from("billing_plans")
      .select("code, name, monthly_price, monthly_receipts, recommended_size, is_unlimited, is_featured, max_members, chat_storage_mb, vault_storage_mb")
      .order("sort_order");
    plans = data ?? [];
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
        <h2 className="mt-4 text-balance break-keep text-3xl font-bold tracking-tight text-zinc-900">모든 기능은 같고, 팀 규모에 맞춰 고르세요</h2>
        <p className="mt-2 text-balance break-keep text-zinc-600">플랜 안에서는 인원이 늘어도 같은 가격. 영수증부터 결재·정산·세무 마감까지 전부 포함, 도입비 0원.</p>
      </div>
      <ul className="mx-auto mt-10 grid max-w-md gap-4 md:max-w-none md:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.code}
            className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur ${plan.is_featured ? "border-emerald-400 bg-emerald-50/60 shadow-md" : "border-zinc-200 bg-white shadow-sm"}`}
          >
            {plan.is_featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">추천</span>
            )}
            <p className="break-keep text-sm text-zinc-500">{plan.recommended_size}</p>
            <h3 className="mt-1 text-xl font-semibold text-zinc-900">{plan.name}</h3>
            <p className="mt-4 whitespace-nowrap text-3xl font-bold text-zinc-900">
              {formatWon(plan.monthly_price)}
              <span className="text-base font-normal text-zinc-500"> / 월</span>
              <span className="ml-1 text-xs font-normal text-zinc-500">(VAT 별도)</span>
            </p>
            <p className="mt-5 text-xs font-medium text-zinc-500">이 가격에 포함</p>
            <ul className="mt-2 flex flex-col gap-2.5">
              {planBenefits(plan).map((b) => (
                <li key={b.label} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0">
                    <span className="block break-keep text-zinc-800">{b.label}</span>
                    {b.sub && <span className="block break-keep text-sm text-zinc-500">{b.sub}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-center text-sm font-semibold text-zinc-900">모든 플랜에 똑같이 포함</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {COMMON_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-zinc-700">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span className="break-keep">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* 요금 기준(D-199) — 문의·분쟁을 줄이려고 한 줄씩. 연간 선결제는 월간 결제로 먼저 선보인 뒤 다시 정한다(D-133) */}
      <div className="mx-auto mt-4 max-w-4xl px-1">
        <p className="text-sm font-semibold text-zinc-700">요금 기준</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {PRICING_RULES.map((r) => (
            <li key={r} className="break-keep text-sm text-zinc-500">
              · {r}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
