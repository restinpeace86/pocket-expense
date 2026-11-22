"use client";

import { BellRing, Loader2, MessageCircle } from "lucide-react";
import { showSaved } from "@/lib/ui/saved-event";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setAlimtalkEnabledAction as setAlimtalkEnabledActionRaw } from "@/app/workspace/[id]/admin/features/actions";
import { FormError } from "@/components/onboarding/field";
import { guarded } from "@/lib/action-guard";
import { BRAND } from "@/lib/brand";
import type { AlimtalkStatus } from "@/lib/notify/alimtalk-status";

const setAlimtalkEnabledAction = guarded(setAlimtalkEnabledActionRaw);

// 설정 › 기능 사용 '결재 알림 받는 곳'(D-295 → D-297): 앱 알림·채팅은 늘, 카카오 알림톡은 프로 이상 + 켬.
// 관리자는 앱을 모른다고 보고 무엇이·누구에게·언제 가는지 예시와 함께 보여 준다
export function AlimtalkSwitch({ status, historyHref }: { status: AlimtalkStatus; historyHref: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { included, enabled, ready } = status;
  const canTurnOn = included && ready;
  const disabled = pending || (!enabled && !canTurnOn);
  const toggle = () => {
    if (enabled && !confirm("카카오 알림톡을 끌까요?\n\n끄면 결재 알림은 앱 알림과 채팅 [알림]방으로만 가요.")) return;
    setError(null);
    start(async () => {
      const r = await setAlimtalkEnabledAction(!enabled);
      if (r.error) setError(r.error);
      else showSaved();
    });
  };
  const note = !included
    ? "프로(49,000원) 이상 요금제에 포함돼요. 지금 요금제에서는 앱 알림과 채팅으로 받아요."
    : !ready
      ? "카카오 심사가 진행 중이에요. 심사가 끝나면 여기서 켤 수 있어요. 그때까지는 앱 알림과 채팅으로 받아요."
      : enabled
        ? "켜져 있어요. 앱 알림을 받지 못한 사람에게 카카오톡으로도 보내요."
        : "꺼져 있어요. 켜면 앱 알림을 받지 못한 사람에게 카카오톡으로도 보내요. 추가 요금은 없어요.";
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-label="결재 알림 받는 곳" data-alimtalk-card>
      <p className="font-semibold">결재 알림 받는 곳</p>
      <p className="mt-0.5 text-sm text-zinc-600">결재 요청·반려·완료 알림이 어디로 가는지 정해요.</p>

      <div className="mt-3 flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <BellRing className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">앱 알림 · 채팅 [알림]방</p>
          <p className="text-sm text-zinc-600">늘 켜져 있어요. 휴대폰 알림과 {BRAND.name} 채팅의 [알림]방으로 받아요.</p>
        </div>
        <span className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">항상</span>
      </div>

      <div className="mt-2 flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
        <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${enabled ? "bg-amber-100 text-amber-800" : "bg-zinc-200 text-zinc-500"}`}>
          <MessageCircle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">카카오톡 알림톡</p>
          <p className="text-sm text-zinc-600" data-alimtalk-note>
            {note}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="카카오톡 알림톡 사용"
          disabled={disabled}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-brand-600" : "bg-zinc-300"}`}
        >
          <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
          {pending && <Loader2 className="absolute -left-6 size-4 animate-spin text-zinc-400" />}
        </button>
      </div>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold text-brand-700">카카오톡으로는 이렇게 가요</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,15rem)_1fr]">
          <div className="rounded-xl bg-[#b2c7da] p-3" aria-hidden>
            <div className="break-keep rounded-lg bg-white p-3 text-xs leading-relaxed text-zinc-800 shadow-sm">
              <p className="mb-1 rounded bg-[#fee500] px-2 py-1 font-semibold">알림톡 도착</p>
              <p className="font-semibold">[{BRAND.name}] 결재 요청</p>
              <p className="mt-1">새로운 지출결의서가 상신되었습니다.</p>
              <p className="mt-1">상신자: 김개발 (개발팀)</p>
              <p>금액: 72,000 원 (영수증 3장)</p>
              <p className="mt-2 rounded border border-zinc-200 py-1.5 text-center">결재하러 가기</p>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-zinc-600">
            <li>
              보내는 알림은 <b>결재 요청</b>(결재자에게) · <b>반려</b> · <b>결재 완료</b>(신청한 사람에게) 3가지예요.
            </li>
            <li>앱 알림을 받은 사람에게는 카카오톡을 또 보내지 않아요. 알림을 꺼 두었거나 앱을 깔지 않은 사람만 받아요.</li>
            <li>직원 정보에 휴대폰 번호가 있어야 받아요.</li>
            <li>
              보낸 기록과 실패한 건은{" "}
              <Link href={historyHref} className="font-semibold text-brand-700 underline underline-offset-2">
                알림 이력
              </Link>
              에서 볼 수 있어요.
            </li>
          </ul>
        </div>
      </details>
      <FormError message={error} />
    </section>
  );
}
