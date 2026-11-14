"use client";

import { useState, useTransition } from "react";
import { updateFeedbackAction as updateFeedbackActionRaw } from "@/app/app-admin/feedback/actions";
import { FEEDBACK_STATUS_LABEL, type FeedbackStatus } from "@/lib/feedback-desk/format";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const updateFeedbackAction = guarded(updateFeedbackActionRaw);

// 운영자: 의견 상태·메모 바꾸기 (D-246)
export function FeedbackStatusForm({ id, status, note }: { id: string; status: FeedbackStatus; note: string | null }) {
  const [s, setS] = useState<FeedbackStatus>(status);
  const [n, setN] = useState(note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await updateFeedbackAction(id, s, n);
      setMsg(r.error ?? "저장했어요.");
    });
  return (
    <div className="flex w-full flex-wrap items-start gap-2 sm:w-72 sm:flex-col sm:items-stretch">
      <label className="sr-only" htmlFor={`fb-status-${id}`}>
        상태
      </label>
      <select id={`fb-status-${id}`} value={s} onChange={(e) => setS(e.target.value as FeedbackStatus)} className="min-h-11 rounded-lg border border-zinc-300 px-2 text-sm" data-fb-status>
        {(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((k) => (
          <option key={k} value={k}>
            {FEEDBACK_STATUS_LABEL[k]}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`fb-note-${id}`}>
        운영자 메모
      </label>
      <textarea id={`fb-note-${id}`} value={n} onChange={(e) => setN(e.target.value)} rows={2} placeholder="운영자 메모(회사에는 안 보여요)" className="min-h-11 flex-1 rounded-lg border border-zinc-300 p-2 text-sm" />
      <button type="button" onClick={save} disabled={busy} className="min-h-11 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white disabled:opacity-60" data-fb-save>
        저장
      </button>
      {msg && (
        <span role="status" className="text-xs text-zinc-600">
          {msg}
        </span>
      )}
    </div>
  );
}
