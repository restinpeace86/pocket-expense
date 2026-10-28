"use client";

import { useState, useTransition } from "react";
import { officeOverrideItemAccountAction } from "@/app/tax-office/[companyId]/item-actions";
import { guardAction } from "@/lib/action-guard";

// 세무사무소: 영수증 한 건의 계정과목 고르기 (D-156). 회사가 마감한 달이면 바꿀 수 없다
export function OfficeItemAccount({
  itemId,
  current,
  overridden,
  titles,
  locked,
  pendingRequest = false,
}: {
  itemId: string;
  current: { id: string | null; name: string | null; code: string | null };
  overridden: boolean;
  titles: { id: string; name: string; code: string | null }[];
  locked: boolean;
  pendingRequest?: boolean; // 회사 확인 요청이 처리 전이면 [이대로 확인]
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [value, setValue] = useState(current.id ?? "");
  const [isOverridden, setOverridden] = useState(overridden);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (locked) return <span className="text-sm">{current.name ? `${current.name}${current.code ? ` (${current.code})` : ""}` : "미지정"}</span>;
  return (
    <span className="flex flex-col gap-1">
      <select
        aria-label="영수증 계정과목"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value || null;
          const before = value;
          setValue(e.target.value);
          setError(null);
          startTransition(async () => {
            const r = await guardAction(() => officeOverrideItemAccountAction(itemId, next));
            if (!r.ok) {
              setValue(before);
              return setError(r.error);
            }
            setOverridden(r.overridden);
            setConfirmed(true); // 고르면 회사 확인 요청도 처리된다
          });
        }}
        className="min-h-10 w-full max-w-full rounded-lg border border-zinc-300 bg-white px-2 text-base md:min-h-9 md:max-w-[9.5rem] md:text-sm"
      >
        <option value="">{isOverridden ? "분류 기준으로 되돌리기" : "계정과목 미지정"}</option>
        {titles.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.code ? ` (${t.code})` : ""}
          </option>
        ))}
      </select>
      {isOverridden && <span className="w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800">영수증별 조정</span>}
      {pendingRequest && !confirmed && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            // 지금 계정과목 그대로 확인 처리(영수증별 조정이면 그 값, 아니면 분류 기준)
            startTransition(async () => {
              const r = await guardAction(() => officeOverrideItemAccountAction(itemId, isOverridden ? value || null : null));
              if (!r.ok) return setError(r.error);
              setConfirmed(true);
            });
          }}
          className="min-h-9 w-fit rounded-lg border border-emerald-300 bg-white px-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
        >
          이대로 확인
        </button>
      )}
      {confirmed && pendingRequest && <span className="text-[11px] text-emerald-700">확인 요청 처리했어요</span>}
      {pending && <span className="text-[11px] text-zinc-400">저장 중…</span>}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
