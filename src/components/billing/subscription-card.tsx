import { AlertTriangle, CheckCircle2, CreditCard, Receipt } from "lucide-react";
import type { BillingPlan } from "@/lib/admin/billing";
import { subscriptionCharge } from "@/lib/billing/checkout";
import { isSubscribed, mdKo, pastDueSchedule, type BillingState } from "@/lib/billing/state";
import type { StorageAddon } from "@/lib/billing/storage";
import { formatWon } from "@/lib/format";
import { SubscriptionButtons } from "./subscription-actions";

// 요금제 화면 맨 위 구독 카드(D-298): 상태 · 요금제·저장 공간 · 매월 금액 · 카드 · 다음 결제일 · 예약된 바꾸기·해지 · 미납 안내 · 결제 내역
const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "첫 결제 예정", cls: "bg-sky-50 text-sky-800" },
  active: { label: "구독 중", cls: "bg-emerald-50 text-emerald-800" },
  past_due: { label: "결제 실패", cls: "bg-red-50 text-red-700" },
  canceled: { label: "해지됨", cls: "bg-zinc-100 text-zinc-700" },
  pending: { label: "결제 전", cls: "bg-zinc-100 text-zinc-700" },
};
const KIND: Record<string, string> = { first: "첫 결제", renewal: "정기 결제", retry: "다시 결제" };
const dateKo = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString();
  return `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.`;
};

// 결제 화면에서 돌아온 결과(토스 → /admin/billing/card → 여기)
export function BillingResult({ kind, msg }: { kind?: string; msg?: string }) {
  if (!kind) return null;
  const ok = kind === "paid" || kind === "scheduled" || kind === "card_saved";
  const text =
    kind === "paid"
      ? "결제했어요. 이제 구독 중이에요. 결제 내역에서 영수증을 볼 수 있어요."
      : kind === "scheduled"
        ? "카드를 등록했어요. 무료 기간이 끝난 다음 날 첫 결제를 해요."
        : kind === "card_saved"
          ? "카드를 바꿨어요. 다음 결제부터 새 카드로 결제해요."
          : kind === "card_canceled"
            ? "카드 등록을 그만뒀어요. 결제되지 않았어요."
            : kind === "pay_failed"
              ? `결제하지 못했어요${msg ? `: ${msg}` : ""}. 다른 카드로 다시 시도해 주세요.`
              : `카드를 등록하지 못했어요${msg ? `: ${msg}` : ""}. 다시 시도해 주세요.`;
  return (
    <p role={ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} data-billing-result={kind}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <span className="break-keep">{text}</span>
    </p>
  );
}

export function SubscriptionCard({ billing, plans, storageAddons, creditsLeft }: { billing: BillingState; plans: BillingPlan[]; storageAddons: StorageAddon[]; creditsLeft: number }) {
  const s = billing.subscription;
  if (!s || (s.status === "pending" && !billing.payments.length)) return null;
  const plan = plans.find((p) => p.code === s.plan_code);
  const price = (gb: number) => (gb ? (storageAddons.find((a) => a.storage_gb === gb)?.monthly_price ?? 0) : 0);
  const monthly = subscriptionCharge(plan?.monthly_price ?? 0, price(s.storage_gb), false);
  const pendingPlan = s.pending_plan_code ? plans.find((p) => p.code === s.pending_plan_code) : null;
  const st = STATUS[s.status] ?? STATUS.pending;
  const sched = s.past_due_since ? pastDueSchedule(s.past_due_since) : null;
  const subscribed = isSubscribed(s);
  return (
    <section id="subscription" className="scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" data-subscription={s.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">내 구독</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">
        {plan?.name ?? s.plan_code} 플랜{s.storage_gb ? <span className="text-lg font-semibold"> + 저장 공간 {s.storage_gb}GB</span> : null}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-zinc-500">매월 결제 금액</dt>
          <dd className="font-semibold tabular-nums text-zinc-900">
            {formatWon(monthly.total)} <span className="text-xs font-normal text-zinc-500">(VAT 포함)</span>
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-zinc-500">{s.status === "scheduled" ? "첫 결제일" : s.cancel_at_period_end ? "해지일" : "다음 결제일"}</dt>
          <dd className="font-semibold text-zinc-900" data-next-billing={s.next_billing_on ?? ""}>
            {s.status === "past_due" ? "결제 실패 — 아래 안내" : s.next_billing_on ? mdKo(s.next_billing_on) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-zinc-500">결제 카드</dt>
          <dd className="flex items-center gap-1.5 text-zinc-900">
            <CreditCard className="size-4 text-zinc-400" aria-hidden />
            <span className="tabular-nums">{s.card_label ?? "—"}</span>
          </dd>
        </div>
        {(s.status === "active" || s.status === "past_due") && (
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-zinc-500">이번 달 남은 AI 영수증 읽기</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{creditsLeft.toLocaleString("ko-KR")}장 <span className="text-xs font-normal text-zinc-500">· 매월 1일 다시 채워져요</span></dd>
          </div>
        )}
      </dl>

      {pendingPlan && s.pending_storage_gb !== null && s.status !== "scheduled" && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900" data-pending-change>
          다음 결제일{s.next_billing_on ? `(${mdKo(s.next_billing_on)})` : ""}부터 <b>{pendingPlan.name} 플랜{s.pending_storage_gb ? ` + 저장 공간 ${s.pending_storage_gb}GB` : ""}</b>으로 바뀌어요.
        </p>
      )}
      {s.cancel_at_period_end && s.next_billing_on && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-cancel-scheduled>
          해지를 신청했어요. {mdKo(s.next_billing_on)}부터 결제하지 않고, 그때까지는 지금처럼 쓸 수 있어요. 지난 자료는 해지 뒤에도 볼 수 있어요.
        </p>
      )}
      {s.status === "past_due" && sched && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert" data-past-due>
          <p className="font-semibold">{mdKo(s.past_due_since!)} 결제에 실패했어요.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 break-keep">
            <li>{mdKo(sched.retryUntil)}까지 매일 아침 다시 결제해 봐요.</li>
            <li>
              {mdKo(sched.graceUntil)}까지 카드를 바꾸거나 결제하지 않으면 <b>{mdKo(sched.blockFrom)}부터 새 영수증 올리기·서류 변환이 멈춰요.</b> 조회·결재·정산·세무 마감은 그대로 돼요.
            </li>
            <li>{mdKo(sched.cancelOn)}까지 결제되지 않으면 구독이 해지돼요. 자료는 지워지지 않아요.</li>
          </ul>
          {billing.blocked && <p className="mt-1 font-semibold">지금 새 영수증 올리기가 멈춰 있어요. 결제하면 바로 풀려요.</p>}
        </div>
      )}
      {s.status === "canceled" && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${s.cancel_reason === "unpaid" ? "bg-red-50 text-red-800" : "bg-zinc-50 text-zinc-700"}`} data-canceled={s.cancel_reason ?? ""}>
          {s.cancel_reason === "unpaid"
            ? "결제가 30일 밀려 구독이 해지됐어요. 새 영수증 올리기가 멈춰 있어요. 아래에서 다시 결제하면 바로 풀려요. 지난 자료는 그대로 볼 수 있어요."
            : "구독이 해지됐어요. 지난 자료는 그대로 볼 수 있어요. 아래에서 다시 시작할 수 있어요."}
        </p>
      )}

      {subscribed && <SubscriptionButtons plan={s.plan_code} gb={s.storage_gb} status={s.status} cancelAtEnd={s.cancel_at_period_end} nextLabel={s.next_billing_on ? mdKo(s.next_billing_on) : null} />}

      {billing.payments.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Receipt className="size-4 text-zinc-500" aria-hidden />
            결제 내역
          </p>
          <ul className="mt-2 divide-y divide-zinc-100" data-payments>
            {billing.payments.map((p) => {
              const pp = plans.find((x) => x.code === p.plan_code);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm" data-payment={p.status}>
                  <span className="min-w-0">
                    <span className="block text-zinc-900">
                      {dateKo(p.created_at)} · {KIND[p.kind] ?? p.kind}
                      {p.coupon && <span className="ml-1 rounded bg-rose-50 px-1.5 text-xs font-semibold text-rose-600">후기 쿠폰 50%</span>}
                    </span>
                    <span className="block break-keep text-xs text-zinc-500">
                      {pp?.name ?? p.plan_code} 플랜{p.storage_gb ? ` + ${p.storage_gb}GB` : ""}
                      {p.status === "paid" && p.period_start && p.period_end ? ` · ${mdKo(p.period_start)} ~ ${mdKo(p.period_end)}` : ""}
                      {p.status === "failed" && p.fail_message ? ` · ${p.fail_message}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <b className="tabular-nums">{formatWon(p.total)}</b>
                    {p.status === "paid" ? (
                      p.receipt_url ? (
                        <a href={p.receipt_url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center text-xs font-semibold text-brand-700 underline underline-offset-2">
                          영수증
                        </a>
                      ) : (
                        <span className="text-xs text-emerald-700">결제 완료</span>
                      )
                    ) : (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">실패</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 break-keep text-xs text-zinc-500">카드 결제 영수증(매출전표)은 [영수증]에서 내려받을 수 있어요.</p>
        </div>
      )}
    </section>
  );
}
