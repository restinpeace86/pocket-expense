"use client";

import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changeBillingAction as changeBillingActionRaw,
  payNowAction as payNowActionRaw,
  prepareBillingAction as prepareBillingActionRaw,
  setBillingCancelAction as setBillingCancelActionRaw,
} from "@/app/workspace/[id]/admin/billing/actions";
import { guarded } from "@/lib/action-guard";
import { BRAND } from "@/lib/brand";
import { issueId } from "@/lib/billing/portone-format";

// 정기결제 버튼들(D-298 → D-312). 카드 정보는 포트원(KG이니시스) 카드 등록창에서만 받는다 — 우리 화면·서버는 카드 번호를 보지 않는다
const prepareBillingAction = guarded(prepareBillingActionRaw);
const changeBillingAction = guarded(changeBillingActionRaw);
const setBillingCancelAction = guarded(setBillingCancelActionRaw);
const payNowAction = guarded(payNowActionRaw);

// 포트원 카드 등록창 열기 → PC는 창이 닫히면 결과(billingKey)를 들고 /admin/billing/card(서버)로, 휴대폰은 포트원이 그 주소로 보낸다
// 그만두면 아무 말 없이 그대로, 실패하면 이유를 보여 준다
export async function openCardWindow(companyId: string, plan: string, gb: number): Promise<string | null> {
  const r = await prepareBillingAction(plan, gb);
  if (!r.ok) return r.error;
  const cardUrl = `${window.location.origin}/workspace/${companyId}/admin/billing/card`;
  try {
    const PortOne = await import("@portone/browser-sdk/v2");
    const res = await PortOne.requestIssueBillingKey({
      storeId: r.storeId,
      channelKey: r.channelKey,
      billingKeyMethod: "CARD",
      issueId: issueId(r.customerKey),
      issueName: `${BRAND.name} 월 구독 카드 등록`,
      customer: { customerId: r.customerKey, fullName: r.customerName, email: r.email || undefined, phoneNumber: r.phone || undefined },
      offerPeriod: { interval: "1m" },
      redirectUrl: cardUrl,
    });
    if (!res) return null; // 휴대폰: 포트원이 cardUrl로 보냄
    if (res.code !== undefined) {
      if (/cancel|취소/i.test(`${res.code} ${res.message ?? ""} ${res.pgMessage ?? ""}`)) return null;
      return (res.message || "카드를 등록하지 못했어요.").slice(0, 200);
    }
    window.location.assign(`${cardUrl}?billingKey=${encodeURIComponent(res.billingKey)}`);
    return null;
  } catch {
    return "카드 등록창을 열지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}

const btn = "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-60";

// 결제 시작: 자동결제 동의 체크 → 카드 등록창
export function StartSubscriptionButton({ plan, gb, label, note }: { plan: string; gb: number; label: string; note: string }) {
  const { id } = useParams<{ id: string }>();
  const [agree, setAgree] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2" data-billing-start>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-billing-agree />
        <span className="break-keep">
          매월 자동결제와 <a href="/terms" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">이용약관</a>(유료 서비스·해지)에 동의해요
        </span>
      </label>
      <button
        type="button"
        disabled={!agree || busy}
        onClick={() =>
          start(async () => {
            setError(null);
            const e = await openCardWindow(id, plan, gb);
            if (e) setError(e);
          })
        }
        className={`${btn} min-h-12 w-full bg-brand-600 text-base text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600`}
        data-summary-pay
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label}
      </button>
      <p className="break-keep text-center text-xs text-zinc-600">{note}</p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// 결제 중: 고른 구성으로 바꾸기(다음 결제일부터)
export function ChangePlanButton({ plan, gb, same, scheduled }: { plan: string; gb: number; same: boolean; scheduled: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy || same}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await changeBillingAction(plan, gb);
            if (!r.ok) return setMsg({ ok: false, text: r.error });
            setMsg({ ok: true, text: r.when === "now" ? "바꿨어요. 첫 결제부터 이 구성으로 결제해요." : r.when === "same" ? "지금 구성 그대로 쓰도록 했어요." : "다음 결제일부터 이 구성으로 바뀌어요. 그때까지는 지금 구성 그대로예요." });
            router.refresh();
          })
        }
        className={`${btn} min-h-12 w-full bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500`}
        data-billing-change
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {same ? "지금 쓰는 구성이에요" : scheduled ? "이 구성으로 바꾸기" : "다음 결제일부터 이 구성으로 바꾸기"}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// 구독 카드의 버튼: 카드 바꾸기 · 지금 다시 결제(미납) · 해지 신청/취소
export function SubscriptionButtons({ plan, gb, status, cancelAtEnd, nextLabel }: { plan: string; gb: number; status: string; cancelAtEnd: boolean; nextLabel: string | null }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (f: () => Promise<{ ok: boolean; text: string } | null>) =>
    start(async () => {
      setMsg(null);
      const r = await f();
      if (r) setMsg(r);
      router.refresh();
    });
  const pastDue = status === "past_due";
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {pastDue && (
          <button type="button" disabled={busy} onClick={() => run(async () => { const r = await payNowAction(); return r.ok ? { ok: true, text: "결제했어요. 이제 그대로 쓰실 수 있어요." } : { ok: false, text: r.error }; })} className={`${btn} bg-red-600 text-white hover:bg-red-700`} data-billing-paynow>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            지금 다시 결제
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => run(async () => { const e = await openCardWindow(id, plan, gb); return e ? { ok: false, text: e } : null; })} className={`${btn} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`} data-billing-card>
          {pastDue ? "카드 바꾸고 결제" : "카드 바꾸기"}
        </button>
        {!pastDue && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!cancelAtEnd && !confirm(status === "scheduled" ? "구독을 해지할까요?\n\n아직 첫 결제 전이라 바로 해지되고 결제하지 않아요." : `구독을 해지할까요?\n\n${nextLabel ?? "다음 결제일"}부터 결제하지 않아요. 그때까지는 지금처럼 쓰고, 지난 자료는 해지 뒤에도 볼 수 있어요.`)) return;
              run(async () => {
                const r = await setBillingCancelAction(!cancelAtEnd);
                if (!r.ok) return { ok: false, text: r.error };
                return { ok: true, text: r.result === "resumed" ? "해지 신청을 취소했어요. 계속 자동결제해요." : r.result === "canceled" ? "해지했어요." : "해지를 신청했어요. 다음 결제일부터 결제하지 않아요." };
              });
            }}
            className={`${btn} border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50`}
            data-billing-cancel
          >
            {cancelAtEnd ? "해지 신청 취소" : "해지 신청"}
          </button>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
