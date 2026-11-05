"use client";

import { Check, HardDrive, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setChatAttachmentDaysAction } from "@/app/workspace/[id]/admin/chat-settings/actions";
import { FormError } from "@/components/onboarding/field";
import { bytesLabel } from "@/lib/chat/format";

export type RetentionStatus = { used: number; limit: number; days: number; older_than_30: number; older_than_60: number };

const OPTIONS = [
  { days: 30, hint: "가장 많이 주고받을 수 있어요" },
  { days: 60, hint: "중간" },
  { days: 90, hint: "기본 · 가장 오래 남아요" },
] as const;

// 채팅 저장 공간·보관 기간(D-212). 짧게 바꾸면 그보다 오래된 파일은 오늘 새벽에 지워진다고 먼저 묻는다
export function ChatRetention({ status }: { status: RetentionStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pct = status.limit > 0 ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0;
  const freed = (d: number) => (d === 30 ? status.older_than_30 : d === 60 ? status.older_than_60 : 0);

  const choose = (days: number) => {
    if (days === status.days || pending) return;
    if (days < status.days) {
      const f = freed(days);
      const ok = confirm(
        `보관 기간을 ${days}일로 줄일까요?\n\n보낸 지 ${days}일이 지난 채팅 사진·파일과 끝난 지 ${days}일이 지난 회의 자료는 오늘 새벽에 지워져요${f > 0 ? `(약 ${bytesLabel(f)} 비워짐)` : ""}. 글·안건은 남고, 지워진 파일은 되살릴 수 없어요.`,
      );
      if (!ok) return;
    }
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await setChatAttachmentDaysAction(days);
      if (r.error) setError(r.error);
      else setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-label="사진·파일 저장 공간">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <HardDrive className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">사진·파일 저장 공간</p>
            <p className="text-xs text-zinc-500">채팅 사진·파일과 회의 자료를 함께 세요.</p>
            <p className="text-sm text-zinc-600">
              <span className="font-semibold tabular-nums text-zinc-900">{bytesLabel(status.used)}</span> / {bytesLabel(status.limit)} 사용 중
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700">{pct}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-label="저장 공간 사용률" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-brand-600"}`} style={{ width: `${Math.max(pct, status.used > 0 ? 1 : 0)}%` }} />
        </div>
        {pct >= 90 && <p className="mt-2 text-sm text-red-700">거의 다 찼어요. 보관 기간을 줄이면 오래된 파일이 지워져 다시 보낼 수 있어요.</p>}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4" aria-labelledby="retention-title">
        <h2 id="retention-title" className="font-semibold">
          사진·파일 보관 기간
        </h2>
        <p className="mt-0.5 text-sm text-zinc-600">채팅 사진·파일은 보낸 날부터, 회의 자료는 회의가 끝난 날부터 이 기간이 지나면 자동으로 지워져요. 글·안건은 남고, 영수증·증빙은 지우지 않아요.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="사진·파일 보관 기간">
          {OPTIONS.map((o) => {
            const on = status.days === o.days;
            const f = freed(o.days);
            return (
              <button
                key={o.days}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending}
                onClick={() => choose(o.days)}
                className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left disabled:opacity-60 ${on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-zinc-200 hover:bg-zinc-50"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-base ${on ? "font-bold text-brand-700" : "font-semibold text-zinc-900"}`}>{o.days}일</span>
                  <span className="block text-xs text-zinc-500">{!on && o.days < status.days && f > 0 ? `지금 바꾸면 약 ${bytesLabel(f)} 비워짐` : o.hint}</span>
                </span>
                {on && (pending ? <Loader2 className="size-4 shrink-0 animate-spin text-brand-600" /> : <Check className="size-4 shrink-0 text-brand-600" />)}
              </button>
            );
          })}
        </div>
        {saved && !pending && (
          <p className="mt-2 text-sm text-green-700" role="status">
            저장했어요. 바뀐 기간은 오늘 새벽 정리부터 적용돼요.
          </p>
        )}
        <FormError message={error} />
      </section>
    </div>
  );
}
