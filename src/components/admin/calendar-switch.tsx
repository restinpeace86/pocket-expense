"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setCalendarEnabledAction } from "@/app/workspace/[id]/admin/calendar-settings/actions";
import { FormError } from "@/components/onboarding/field";

// 사내 캘린더 켜기·끄기(D-208)
export function CalendarSwitch({ enabled, calendarHref }: { enabled: boolean; calendarHref: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () => {
    if (enabled && !confirm("캘린더를 끌까요?\n\n메뉴와 화면만 숨고 일정·회의실은 지워지지 않아요. 끈 동안에는 회의 10분 전 안내가 가지 않아요.")) return;
    setError(null);
    start(async () => {
      const r = await setCalendarEnabledAction(!enabled);
      if (r.error) setError(r.error);
    });
  };
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-label="사내 캘린더 사용">
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"}`}>
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">사내 캘린더 사용</p>
          <p className="text-sm text-zinc-600">{enabled ? "켜져 있어요. 관리자 메뉴 [캘린더]와 직원 하단 [캘린더] 탭으로 들어가요." : "꺼져 있어요. 켜면 관리자 메뉴와 직원 하단 메뉴에 캘린더가 생겨요."}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="사내 캘린더 사용"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-brand-600" : "bg-zinc-300"}`}
        >
          <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
          {pending && <Loader2 className="absolute -left-6 size-4 animate-spin text-zinc-400" />}
        </button>
      </div>
      {enabled && (
        <Link href={calendarHref} className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl border border-zinc-300 px-4 text-sm font-semibold hover:bg-zinc-50">
          캘린더 열기
        </Link>
      )}
      <FormError message={error} />
    </section>
  );
}
