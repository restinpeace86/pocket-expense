"use client";

import { MessageSquareText } from "lucide-react";
import { useState, useTransition } from "react";
import { requestTaxReviewAction } from "@/lib/claims/actions";
import { guardAction } from "@/lib/action-guard";

// 세무사무소가 계정과목을 관리하는 회사(D-156): 관리자는 영수증별 계정과목을 직접 바꾸지 않고 [세무사 확인 요청] 메모만 남긴다
export function TaxReviewCell({
  itemId,
  accountName,
  overridden,
  request,
  resolved,
  officeName,
}: {
  itemId: string;
  accountName: string | null;
  overridden: boolean;
  request: string | null;
  resolved: boolean;
  officeName: string;
}) {
  const [memo, setMemo] = useState(request ?? "");
  const [saved, setSaved] = useState<{ request: string | null; resolved: boolean }>({ request, resolved });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(value: string) {
    setError(null);
    startTransition(async () => {
      const r = await guardAction(() => requestTaxReviewAction(itemId, value));
      if (!r.ok) return setError(r.error);
      setSaved({ request: value.trim() || null, resolved: false });
      setEditing(false);
    });
  }

  return (
    <span className="mt-1 flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1 text-xs text-zinc-700">
        {accountName ?? "계정과목 미지정"}
        {overridden && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800">세무사 조정</span>}
        <span className="text-zinc-400">· {officeName} 관리</span>
      </span>
      {saved.request && !editing && (
        <span className={`break-keep rounded-lg px-2 py-1 text-xs ${saved.resolved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {saved.resolved ? "세무사가 확인했어요: " : "세무사 확인 요청: "}
          {saved.request}
          {!saved.resolved && (
            <button type="button" onClick={() => setEditing(true)} className="ml-1 underline underline-offset-2">
              고치기
            </button>
          )}
        </span>
      )}
      {!saved.request && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-9 w-fit items-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50">
          <MessageSquareText className="size-3.5" aria-hidden />
          세무사 확인 요청
        </button>
      )}
      {editing && (
        <span className="flex flex-col gap-1">
          <input
            aria-label="세무사에게 확인할 내용"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={200}
            placeholder="예: 거래처 2명 동석 — 접대비가 맞는지 확인 부탁"
            className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-base lg:text-sm"
          />
          <span className="flex gap-1">
            <button type="button" disabled={pending || !memo.trim()} onClick={() => send(memo)} className="min-h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
              요청 보내기
            </button>
            {saved.request && (
              <button type="button" disabled={pending} onClick={() => send("")} className="min-h-9 rounded-lg border border-zinc-300 px-3 text-xs">
                요청 취소
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => setEditing(false)} className="min-h-9 rounded-lg px-3 text-xs text-zinc-600">
              닫기
            </button>
          </span>
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
