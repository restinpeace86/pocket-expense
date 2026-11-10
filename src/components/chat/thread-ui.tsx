"use client";

import { Loader2, MessagesSquare, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { suggestThreadSummaryAction, suggestThreadTitleAction } from "@/app/workspace/[id]/chat/thread-actions";
import { listTimeLabel, previewText, timeLabel, type ChatMessage, type ChatThread } from "@/lib/chat/format";
import { fallbackTitle, filterThreads, THREAD_SUMMARY_MAX, THREAD_TITLE_MAX, threadMeta } from "@/lib/chat/threads";
import { Avatar } from "./avatar";
import { useChat } from "./chat-app";
import { ChatOverlay } from "./overlay";

// 서브 대화(D-246, spec/features/improvement-2026-11.md §A) — 메인 카드·만들기·종결 시트·서랍 목록

// 메인 대화: 원래 메시지 아래 카드(시각·제목·참여자·글 수·상태·종결 요약·새 글)
export function ThreadCard({ t, onOpen }: { t: ChatThread; onOpen: () => void }) {
  const open = t.status === "open";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mt-1.5 flex w-[min(17rem,100%)] flex-col gap-1 rounded-2xl border bg-white px-3 py-2.5 text-left shadow-sm hover:bg-zinc-50 ${open ? "border-brand-300" : "border-zinc-200"}`}
      data-thread-card={t.id}
    >
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700">
        <MessagesSquare className="size-3.5" aria-hidden />
        서브 대화
        <span className={`ml-auto rounded-full px-2 py-px text-[11px] ${open ? "bg-brand-50 text-brand-800" : "bg-zinc-100 text-zinc-700"}`}>{open ? "진행 중" : "종결"}</span>
      </span>
      <b className="break-keep text-[14.5px] leading-snug text-zinc-900">{t.title}</b>
      {!open && t.summary && <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[12.5px] text-zinc-800">요약 · {t.summary}</span>}
      <span className="flex items-center gap-1.5">
        <span className="flex">
          {t.people.slice(0, 3).map((p, i) => (
            <span key={p.member_id} className={i ? "-ml-1.5" : ""}>
              <Avatar id={p.member_id} name={p.name} size="sm" />
            </span>
          ))}
        </span>
        <span className="text-xs text-zinc-600">
          {threadMeta(t)} · {timeLabel(t.last_message_at)}
        </span>
        {t.new > 0 && (
          <span className="ml-auto whitespace-nowrap rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white" data-thread-new>
            새 글 {t.new}
          </span>
        )}
      </span>
    </button>
  );
}

function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <ChatOverlay>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
        <section role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 text-zinc-900 md:rounded-3xl">
          <div className="flex items-center">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </section>
      </div>
    </ChatOverlay>
  );
}

// [서브 대화 만들기]: AI가 제목을 채워 두고(3초 안), 사람이 고쳐서 확정
export function ThreadCreateSheet({ roomId, root, onClose, onCreated }: { roomId: string; root: ChatMessage; onClose: () => void; onCreated: (t: ChatThread) => void }) {
  const { supabase } = useChat();
  const [title, setTitle] = useState("");
  const [ai, setAi] = useState<"loading" | "done" | "fallback">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      if (!live || touched.current) return;
      setTitle((v) => v || fallbackTitle(root));
      setAi("fallback");
    }, 3500);
    void suggestThreadTitleAction(roomId, root.id)
      .catch(() => "")
      .then((s) => {
        if (!live || touched.current) return;
        clearTimeout(timer);
        setTitle(s || fallbackTitle(root));
        setAi(s ? "done" : "fallback");
      });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [roomId, root]);
  const create = async () => {
    const t = title.trim();
    if (!t) return setError("제목을 적어 주세요.");
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("chat_thread_open", { p_root: root.id, p_title: t.slice(0, THREAD_TITLE_MAX) });
    setBusy(false);
    if (e || !data) return setError("만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    onCreated(data as unknown as ChatThread);
  };
  return (
    <Sheet title="서브 대화 만들기" label="서브 대화 만들기" onClose={onClose}>
      <div className="rounded-xl bg-zinc-100 px-3 py-2.5 text-[13.5px] leading-relaxed">
        <b className="text-xs text-zinc-600">
          {root.sender_name ?? "알 수 없음"} · {timeLabel(root.created_at)}
        </b>
        <p className="line-clamp-3 break-words">{previewText(root)}</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">제목</span>
        <input
          value={title}
          onChange={(e) => {
            touched.current = true;
            setTitle(e.target.value.slice(0, THREAD_TITLE_MAX));
          }}
          placeholder={ai === "loading" ? "AI가 제목을 만들고 있어요…" : "무슨 건인지 짧게"}
          className="h-12 rounded-xl border-2 border-brand-600 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          data-thread-title
        />
        <span className="flex items-center gap-1 text-xs text-brand-800" data-thread-ai={ai}>
          {ai === "loading" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          {ai === "loading" ? "AI가 제목을 제안하는 중이에요. 바로 적어도 돼요." : ai === "done" ? "AI가 제안한 제목이에요. 고쳐도 돼요." : "원래 메시지에서 제목을 가져왔어요. 고쳐도 돼요."}
        </span>
      </label>
      <p className="break-keep text-[13.5px] leading-relaxed text-zinc-700">
        이 건만 따로 이야기해요. 메인 대화에는 <b>카드 한 장</b>만 남아요. 이 방 사람 모두 볼 수 있어요.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <button type="button" onClick={() => void create()} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-thread-create>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        만들기
      </button>
    </Sheet>
  );
}

// [종결하기]: AI 한 줄 요약(고칠 수 있음, 비우면 요약 없이). 종결해도 [다시 열기] 가능
export function ThreadCloseSheet({ thread, onClose, onClosed }: { thread: ChatThread; onClose: () => void; onClosed: (t: ChatThread) => void }) {
  const { supabase } = useChat();
  const [summary, setSummary] = useState("");
  const [ai, setAi] = useState<"loading" | "done" | "none">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    let live = true;
    void suggestThreadSummaryAction(thread.id)
      .catch(() => "")
      .then((s) => {
        if (!live) return;
        if (!touched.current && s) setSummary(s);
        setAi(s ? "done" : "none");
      });
    return () => {
      live = false;
    };
  }, [thread.id]);
  const close = async () => {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("chat_thread_close", { p_thread: thread.id, p_summary: summary.trim().slice(0, THREAD_SUMMARY_MAX) });
    setBusy(false);
    if (e || !data) return setError(e?.message?.includes("NOT_ALLOWED") ? "만든 사람과 관리자만 종결할 수 있어요." : "종결하지 못했어요. 다시 시도해 주세요.");
    onClosed(data as unknown as ChatThread);
  };
  return (
    <Sheet title="이 서브 대화를 종결할까요?" label="서브 대화 종결" onClose={onClose}>
      <p className="break-keep text-[14px] leading-relaxed text-zinc-700">
        이 건이 끝났으면 종결해 두세요. 메인 대화 카드에 요약이 붙고 <b>&lsquo;종결&rsquo; 목록</b>으로 가요. 입력은 잠기지만, 필요하면 <b>[다시 열기]</b>로 이어서 쓸 수 있어요.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">
          한 줄 요약 <span className="font-normal text-zinc-600">(선택)</span>
        </span>
        <input
          value={summary}
          onChange={(e) => {
            touched.current = true;
            setSummary(e.target.value.slice(0, THREAD_SUMMARY_MAX));
          }}
          placeholder={ai === "loading" ? "AI가 대화를 읽고 요약하고 있어요…" : "무엇이 정해졌는지 한 줄로"}
          className="h-12 rounded-xl border-2 border-brand-600 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          data-thread-summary
        />
        <span className="flex items-center gap-1 text-xs text-brand-800" data-thread-ai={ai}>
          {ai === "loading" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          {ai === "loading" ? "AI가 요약하는 중이에요. 바로 적어도 돼요." : ai === "done" ? "AI가 대화를 읽고 만든 요약이에요. 고쳐도 돼요." : "요약 없이 종결해도 돼요."}
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-zinc-300 font-semibold hover:bg-zinc-50">
          취소
        </button>
        <button type="button" onClick={() => void close()} disabled={busy} className="flex h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-thread-close-confirm>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          종결하기
        </button>
      </div>
    </Sheet>
  );
}

// 서랍 목록: 이 방 서브 대화(검색·진행 중/종결). 실시간으로 다시 불러옴
export function ThreadList({ roomId, roomLabel, onPick, onClose }: { roomId: string; roomLabel: string; onPick: (id: string) => void; onClose: () => void }) {
  const { supabase, useEvents } = useChat();
  const [list, setList] = useState<ChatThread[] | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [q, setQ] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("chat_thread_list", { p_room: roomId });
    setList((data as unknown as ChatThread[]) ?? []);
  }, [supabase, roomId]);
  useEffect(() => {
    void Promise.resolve().then(load);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);
  useEvents((e) => {
    if (e.event !== "thread" && e.event !== "thread_message" && e.event !== "reconnect") return;
    if (e.event !== "reconnect" && e.payload.room_id !== roomId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 300);
  });
  const open = (list ?? []).filter((t) => t.status === "open").length;
  const closed = (list ?? []).length - open;
  const shown = filterThreads(list ?? [], tab, q);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50" data-thread-list>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white pl-4 pr-1">
        <MessagesSquare className="size-5 shrink-0 text-brand-700" aria-hidden />
        <h3 className="min-w-0 flex-1 truncate font-bold">{roomLabel} 서브 대화</h3>
        <button type="button" onClick={onClose} aria-label="서브 대화 닫기" className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-zinc-100">
          <X className="size-5" />
        </button>
      </header>
      <div className="flex shrink-0 flex-col gap-2.5 px-3.5 pt-3">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
          <Search className="size-4 shrink-0" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="서브 대화 제목·요약 검색" aria-label="서브 대화 검색" className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none md:text-sm" />
        </label>
        <div role="tablist" className="flex gap-1.5">
          {(
            [
              ["open", list ? `진행 중 ${open}` : "진행 중"],
              ["closed", list ? `종결 ${closed}` : "종결"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-full px-3.5 text-[13.5px] ${tab === k ? "bg-zinc-900 font-semibold text-white" : "border border-zinc-200 bg-white text-zinc-800"}`} data-thread-tab={k}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3.5" aria-label="서브 대화 목록">
        {list === null && [0, 1].map((i) => <li key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-200/70" />)}
        {list !== null && !shown.length && (
          <li className="px-2 py-8 text-center text-[13px] leading-relaxed text-zinc-600">
            {q.trim() ? "찾는 서브 대화가 없어요." : tab === "open" ? "진행 중인 서브 대화가 없어요. 메시지를 길게 누르거나 오른쪽 클릭해 [서브 대화 만들기]를 눌러 보세요." : "종결된 서브 대화가 없어요."}
          </li>
        )}
        {shown.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onPick(t.id)} className="flex w-full flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50" data-thread-row={t.id}>
              <span className="flex items-center gap-1.5">
                <b className="min-w-0 flex-1 break-keep text-[14px]">{t.title}</b>
                {t.new > 0 && <span className="whitespace-nowrap rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">새 글 {t.new}</span>}
              </span>
              <span className="text-xs text-zinc-600">
                {t.root_sender_name ?? "알 수 없음"} 메시지에서 · {threadMeta(t)} · {listTimeLabel(t.last_message_at)}
              </span>
              {t.status === "closed" && t.summary && <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[12.5px] text-zinc-800">요약 · {t.summary}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
