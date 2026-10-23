"use client";

import { Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { inputClass } from "@/components/ui/page-shell";

// 공지 쓰기 (D-116) — 사내 공지(관리자)·전체 공지(앱 운영자) 같은 모양
type Action = (input: { title: string; body: string }) => Promise<{ ok: true; sent: number } | { ok: false; error: string }>;
export function AnnouncementForm({ action, placeholderTitle, audience, preview = false }: { action?: Action; placeholderTitle: string; audience: string; preview?: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (preview || !action) return;
        if (!confirm(`${audience}에게 공지를 보낼까요? 보낸 공지는 고칠 수 없어요.`)) return;
        setMsg(null);
        start(async () => {
          const r = await action({ title, body });
          if (!r.ok) return setMsg({ ok: false, text: r.error });
          setTitle("");
          setBody("");
          setMsg({ ok: true, text: `공지를 올렸어요. 알림 ${r.sent}건을 보냈어요(알림을 켠 기기 기준).` });
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-800">
          제목<span className="ml-0.5 text-red-600">*</span>
        </span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={placeholderTitle} required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-800">
          내용<span className="ml-0.5 text-red-600">*</span>
        </span>
        <textarea className={`${inputClass} min-h-28 py-2`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !title.trim() || !body.trim()} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          공지 보내기
        </button>
        <span className="text-xs text-zinc-500">받는 사람: {audience}</span>
      </div>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

export function AnnouncementList({ rows }: { rows: { id: string; title: string; body: string; created_at: string; pushed_count: number }[] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">보낸 공지가 없어요.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="break-words">{r.title}</b>
            <span className="text-xs text-zinc-500">
              {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 알림 {r.pushed_count}건
            </span>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}
