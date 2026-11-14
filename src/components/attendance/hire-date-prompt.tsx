"use client";

import { CalendarCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMyHireDateAction as setMyHireDateActionRaw } from "@/app/workspace/[id]/employee/attendance/actions";
import { todayKst } from "@/lib/dates";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const setMyHireDateAction = guarded(setMyHireDateActionRaw);

// 직원 홈: 근태 켠 회사에서 입사일이 비어 있으면 한 번 안내(D-240). 저장하면 사라진다
export function HireDatePrompt() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      if (!date) return setError("입사일을 골라 주세요.");
      const res = await setMyHireDateAction(date);
      if (!res.ok) return setError(res.error ?? null);
      router.refresh();
    });
  return (
    <section aria-label="입사일 넣기" className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5" data-hire-prompt>
      <p className="flex items-center gap-2 text-[15px] font-bold text-brand-950">
        <CalendarCheck className="size-5 shrink-0 text-brand-700" aria-hidden />
        입사일을 넣어 주세요
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-brand-950/80">이 회사에 처음 출근한 날이에요. 연차 계산에 써요. 한 번 넣으면 그 뒤에는 관리자만 고칠 수 있어요.</p>
      <div className="mt-2.5 flex gap-2">
        <input type="date" aria-label="입사일" max={todayKst()} min="1950-01-01" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-[15px]" />
        <button type="button" onClick={save} disabled={busy} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          저장
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
