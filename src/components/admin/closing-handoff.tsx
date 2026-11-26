"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { closeTaxMonthAction } from "@/app/workspace/[id]/admin/export/actions";
import { thrownActionMessage } from "@/lib/action-guard";

// 월 마감 도우미 ④(D-315): 세무사무소가 연결된 회사 — [마감하고 세무사무소에 알리기]. 마감하면 사무소에 알림(D-168)이 가고 사무소가 직접 받는다
export function ClosingHandoffButton({ month, officeName, items }: { month: string; officeName: string; items: number }) {
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const m = `${Number(month.slice(5, 7))}월`;
  const run = () =>
    start(async () => {
      setAsk(false);
      try {
        const r = await closeTaxMonthAction(month);
        setMsg(r.ok ? { ok: true, text: r.already ? `${m}은 이미 마감돼 있어요.` : `${m} 마감을 완료하고 ${officeName}에 알렸어요.` } : { ok: false, text: r.error });
      } catch {
        setMsg({ ok: false, text: thrownActionMessage() });
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setAsk(true)} disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:self-start" data-closing-handoff>
        <Send className="size-4" aria-hidden />
        {pending ? "마감하는 중..." : `${m} 마감하고 세무사무소에 알리기`}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`break-keep text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
      {ask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="handoff-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setAsk(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <h2 id="handoff-title" className="text-lg font-semibold">
              {m}을 마감하고 {officeName}에 알릴까요?
            </h2>
            <ul className="mt-2 list-disc space-y-1 break-keep pl-5 text-sm text-zinc-700">
              <li>
                {officeName}에 알림이 가고, 세무사무소가 장부·영수증·지출결의서·홈택스 자료를 바로 받아요.
              </li>
              <li>
                포함된 {items.toLocaleString("ko-KR")}건은 <b>잠겨요</b> — 계정과목을 바꾸거나 결의서를 지울 수 없어요. 해제는 최고 관리자만 할 수 있어요.
              </li>
              <li>마감 뒤 승인되는 {m} 사용분은 다음 달 마감에 &ldquo;전월 추가분&rdquo;으로 들어가요.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAsk(false)} className="min-h-12 rounded-xl border border-zinc-300 font-medium">
                취소
              </button>
              <button type="button" onClick={run} className="min-h-12 rounded-xl bg-brand-600 font-semibold text-white" data-closing-handoff-confirm>
                마감하고 알리기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
