import { formatWon } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

type Plan = {
  code: string;
  name: string;
  monthly_price: number;
  annual_price: number | null;
  monthly_receipts: number;
  recommended_size: string | null;
  is_unlimited: boolean;
  is_featured: boolean;
};

// 요금제는 billing_plans에서 읽는다(하드코딩 금지). 공용 데이터라 정적으로 캐시한다. (D-046, D-054, D-081)
export async function Pricing() {
  "use cache";
  let plans: Plan[] = [];
  try {
    const { data } = await createPublicClient()
      .from("billing_plans")
      .select("code, name, monthly_price, annual_price, monthly_receipts, recommended_size, is_unlimited, is_featured")
      .order("sort_order");
    plans = data ?? [];
  } catch {
    plans = [];
  }
  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-20">
      <div className="text-center">
        <span className="inline-block text-balance rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-300">
          지금 가입하면 영수증 100장 무료
        </span>
        <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white">인원이 아니라 영수증 장수로</h2>
        <p className="mt-2 text-zinc-400">인당 과금 없는 고정 월 구독. 도입비 0원.</p>
      </div>
      <ul className="mx-auto mt-10 grid max-w-md gap-4 md:max-w-none md:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.code}
            className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur ${plan.is_featured ? "border-emerald-400/60 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}
          >
            {plan.is_featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-emerald-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-900">추천</span>
            )}
            <p className="text-sm text-zinc-400">{plan.recommended_size}</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-4 whitespace-nowrap text-3xl font-bold text-white">
              {formatWon(plan.monthly_price)}
              <span className="text-base font-normal text-zinc-400"> / 월</span>
              <span className="ml-1 text-xs font-normal text-zinc-500">(VAT 별도)</span>
            </p>
            {plan.is_unlimited ? (
              <p className="mt-2 text-zinc-300">
                영수증 <b className="text-white">무제한</b>
                <span className="block text-sm text-zinc-500">공정 사용 기준 월 {plan.monthly_receipts.toLocaleString("ko-KR")}장</span>
              </p>
            ) : (
              <p className="mt-2 text-zinc-300">
                영수증 월 {plan.monthly_receipts.toLocaleString("ko-KR")}장
                <span className="block text-sm text-zinc-500">장당 약 {formatWon(Math.round(plan.monthly_price / plan.monthly_receipts))}</span>
              </p>
            )}
            {plan.annual_price && (
              <p className="mt-4 border-t border-white/10 pt-3 text-sm text-zinc-300">
                연간 결제 시 <b className="text-white">월 {formatWon(Math.round(plan.annual_price / 12))}</b>
                <span className="block text-xs text-zinc-500">
                  연 {formatWon(plan.annual_price)} · 10% 할인 (연 {formatWon(plan.monthly_price * 12 - plan.annual_price)} 절약)
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
