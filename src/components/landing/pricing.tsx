import { Lock } from "lucide-react";
import { formatWon } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

// 요금제는 billing_plans에서 읽는다(하드코딩 금지). 공용 데이터라 정적으로 캐시한다. (D-046, D-054)
export async function Pricing() {
  "use cache";
  let plans: { code: string; name: string; monthly_price: number; monthly_receipts: number; recommended_size: string | null }[] = [];
  try {
    const { data } = await createPublicClient()
      .from("billing_plans")
      .select("code, name, monthly_price, monthly_receipts, recommended_size")
      .order("sort_order");
    plans = data ?? [];
  } catch {
    plans = [];
  }
  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="mx-auto w-full max-w-5xl px-4 py-20">
      <div className="text-center">
        <span className="inline-block rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-300">
          지금 가입하면 영수증 100장 무료 · 이벤트 기간 동안 다 쓰면 100장씩 추가 무료
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">인원이 아니라 영수증 장수로</h2>
        <p className="mt-2 text-zinc-400">인당 과금 없는 고정 월 구독. 도입비 0원.</p>
      </div>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.code} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm text-zinc-400">{plan.recommended_size}</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-4 text-3xl font-bold text-white">
              {formatWon(plan.monthly_price)}
              <span className="text-base font-normal text-zinc-400"> / 월</span>
            </p>
            <p className="mt-2 text-zinc-300">영수증 월 {plan.monthly_receipts.toLocaleString("ko-KR")}장</p>
            <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-zinc-500">
              <Lock className="size-4" /> 유료 결제는 준비 중입니다
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
