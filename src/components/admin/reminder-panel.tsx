"use client";

import { Bell, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { sendRemindersAction } from "@/app/workspace/[id]/admin/members/reminder-actions";
import { measureAction } from "@/lib/perf/client";

// 미제출자 독촉 (admin-team-members.md §E, D-043, D-094): 아직 상신하지 않은 결의서(작성중·반려)가 있는 활성 멤버에게 알림톡 REMINDER.
// 같은 멤버는 하루 1회. 보낸 기록은 [알림 이력]에 남는다.
export type ReminderCandidate = { member_id: string; name: string; department: string | null; has_phone: boolean; open_claims: number; reminded_today: boolean };

export function useSendReminders() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const send = (ids: string[], onDone?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await measureAction("members.reminders", () => sendRemindersAction(ids));
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setMessage({ kind: "ok", text: `독촉 알림 ${r.sent}명에게 보냈어요.${r.skipped.length ? ` 빼고 보냄: ${r.skipped.join(", ")}` : ""}` });
      onDone?.();
    });
  return { pending, message, send };
}

export function ReminderPanel({ candidates, preview = false }: { candidates: ReminderCandidate[]; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const sendable = candidates.filter((c) => !c.reminded_today);
  const [picked, setPicked] = useState<string[]>(() => sendable.map((c) => c.member_id));
  const { pending, message, send } = useSendReminders();
  if (candidates.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setPicked(sendable.map((c) => c.member_id));
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900 hover:bg-amber-100"
      >
        <Bell className="size-4" /> 미제출자 독촉 ({candidates.length}명)
      </button>
      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="remind-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <h2 id="remind-title" className="text-lg font-semibold">
              미제출자 독촉 알림
            </h2>
            <p className="mt-1 text-sm text-zinc-600">아직 상신하지 않은 결의서(작성중·반려)가 있는 직원이에요. 알림톡으로 &ldquo;제출하러 가기&rdquo; 링크를 보내요. 같은 사람에게는 하루 한 번까지예요.</p>
            <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {candidates.map((c) => (
                <li key={c.member_id}>
                  <label className={`flex min-h-11 items-center gap-3 rounded-lg px-2 ${c.reminded_today ? "opacity-60" : "hover:bg-zinc-50"}`}>
                    <input
                      type="checkbox"
                      className="size-5"
                      disabled={c.reminded_today}
                      checked={picked.includes(c.member_id)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.member_id] : p.filter((x) => x !== c.member_id)))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {c.name}
                        {c.department && <span className="ml-1 text-sm font-normal text-zinc-500">{c.department}</span>}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        작성중·반려 {c.open_claims}건{c.reminded_today && " · 오늘 이미 보냄"}
                        {!c.has_phone && <span className="text-red-600"> · 휴대폰 번호 없음(실패로 기록돼요)</span>}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-zinc-300 font-medium">
                취소
              </button>
              <button
                type="button"
                disabled={!picked.length || pending || preview}
                onClick={() => send(picked, () => setOpen(false))}
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {picked.length}명에게 보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
