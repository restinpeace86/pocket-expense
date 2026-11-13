"use client";

import { ChevronDown, ChevronRight, MessagesSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listTimeLabel, type ChatKind, type ChatThread } from "@/lib/chat/format";
import { filterThreads, OPEN_THREAD_EVENT, THREAD_READ_EVENT, threadMeta } from "@/lib/chat/threads";
import { useChat } from "./chat-app";
import { ChatOverlay } from "./overlay";

type MyThread = ChatThread & { room_kind: ChatKind; room_title: string | null; room_members: number };

// 서브 대화 열기: 그 방으로 가서 서브 대화를 연다. 이미 그 방이면 주소만 바뀌고 화면은 그대로라, 열라고 알려 줌
function openThread(router: ReturnType<typeof useRouter>, base: string, t: MyThread) {
  router.push(`${base}/${t.room_id}?thread=${t.id}`);
  window.dispatchEvent(new CustomEvent(OPEN_THREAD_EVENT, { detail: { roomId: t.room_id, threadId: t.id } }));
}

const DROPDOWN_MAX = 8;

// 채팅 목록 맨 위 [내 서브 대화](D-246 → 9-20 드롭다운): 목록 스크롤 밖이라 늘 위에 붙어 있다.
// 누르면 그 자리에서 펼쳐져 내가 참여한 서브 대화(진행 중 최근 글 순 → 종결은 흐리게)와 방별 새 글 수. 고르면 열리고 접힘.
// 8개가 넘으면 [모두 보기] = 예전 모아보기 창. 참여한 서브 대화가 하나도 없으면 줄 자체를 숨긴다
export function MyThreadsRow({ base }: { base: string }) {
  const { supabase, useEvents, membership } = useChat();
  const router = useRouter();
  const [list, setList] = useState<MyThread[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("chat_my_threads");
    setList((data as unknown as MyThread[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const onRead = () => void load();
    window.addEventListener(THREAD_READ_EVENT, onRead);
    return () => {
      window.removeEventListener(THREAD_READ_EVENT, onRead);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);
  useEvents((e) => {
    if (e.event === "reconnect" || e.event === "thread" || (e.event === "thread_message" && e.payload.participants.includes(membership.member_id))) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 400);
    }
  });
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);
  if (!list?.length) return null;
  const count = list.reduce((n, t) => n + (t.status === "open" ? t.new : 0), 0);
  const recent = (a: MyThread, b: MyThread) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
  const ordered = [...filterThreads(list, "open", "").sort(recent), ...filterThreads(list, "closed", "").sort(recent)];
  const shown = ordered.slice(0, DROPDOWN_MAX);
  return (
    <div className="border-b border-zinc-100" data-my-threads-wrap>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="my-threads-dropdown"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50"
        data-my-threads
      >
        <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-[38%] bg-brand-50 text-brand-700">
          <MessagesSquare className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] text-zinc-900">내 서브 대화</b>
          <span className="block truncate text-[13px] text-zinc-600">{expanded ? "고르면 바로 열려요" : `참여 중 ${list.filter((t) => t.status === "open").length}개 · 눌러서 펼치기`}</span>
        </span>
        {!!count && (
          <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white" data-my-threads-new>
            {count}
          </span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {expanded && (
        <ul id="my-threads-dropdown" className="max-h-[50dvh] overflow-y-auto border-t border-zinc-100 bg-zinc-50/60 py-1" aria-label="내 서브 대화 목록" data-my-threads-dropdown>
          {shown.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  openThread(router, base, t);
                }}
                className={`flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left hover:bg-white ${t.status === "closed" ? "opacity-60" : ""}`}
                data-my-thread={t.id}
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] text-zinc-900">
                    {t.title}
                    {t.status === "closed" && <span className="ml-1 text-xs font-normal text-zinc-500">· 요약됨</span>}
                  </b>
                  <span className="block truncate text-xs text-zinc-600">
                    {t.room_title ?? "채팅"} · {listTimeLabel(t.last_message_at)}
                  </span>
                </span>
                {t.status === "open" && t.new > 0 && (
                  <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white" aria-label={`새 글 ${t.new}개`}>
                    {t.new}
                  </span>
                )}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setSheet(true);
              }}
              className="flex min-h-11 w-full items-center justify-center gap-1 text-[13px] font-semibold text-brand-700 hover:bg-white"
              data-my-threads-all
            >
              {ordered.length > DROPDOWN_MAX ? `모두 보기 (${ordered.length})` : "모아보기로 보기"} <ChevronRight className="size-4" aria-hidden />
            </button>
          </li>
        </ul>
      )}
      {sheet && (
        <MyThreadsSheet
          base={base}
          onClose={() => {
            setSheet(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function MyThreadsSheet({ base, onClose }: { base: string; onClose: () => void }) {
  const { supabase } = useChat();
  const router = useRouter();
  const [list, setList] = useState<MyThread[] | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");
  useEffect(() => {
    void supabase.rpc("chat_my_threads").then(({ data }) => setList((data as unknown as MyThread[]) ?? []));
  }, [supabase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const go = (t: MyThread) => {
    onClose();
    openThread(router, base, t);
  };
  const shown = filterThreads(list ?? [], tab, "");
  const openN = (list ?? []).filter((t) => t.status === "open").length;
  return (
    <ChatOverlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
        <section role="dialog" aria-modal="true" aria-label="내 서브 대화" onClick={(e) => e.stopPropagation()} className="flex h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] text-zinc-900 md:h-[70dvh] md:rounded-3xl" data-my-threads-sheet>
          <div className="flex items-center px-5 pt-4">
            <h2 className="text-lg font-bold">내 서브 대화</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
              <X className="size-5" />
            </button>
          </div>
          <p className="px-5 text-[13px] text-zinc-600">내가 만들었거나, 내 메시지에서 시작됐거나, 글을 쓴 서브 대화예요.</p>
          <div role="tablist" className="flex gap-1.5 px-5 pt-3">
            {(
              [
                ["open", list ? `진행 중 ${openN}` : "진행 중"],
                ["closed", list ? `종결 ${list.length - openN}` : "종결"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-full px-3.5 text-[13.5px] ${tab === k ? "bg-zinc-900 font-semibold text-white" : "border border-zinc-200 text-zinc-800"}`}>
                {label}
              </button>
            ))}
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4" aria-label="내 서브 대화 목록">
            {list === null && [0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />)}
            {list !== null && !shown.length && <li className="py-10 text-center text-[13px] text-zinc-600">{tab === "open" ? "참여 중인 서브 대화가 없어요." : "종결된 서브 대화가 없어요."}</li>}
            {shown.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => go(t)} className="flex w-full flex-col gap-1 rounded-2xl border border-zinc-200 p-3 text-left hover:bg-zinc-50" data-my-thread={t.id}>
                  <span className="truncate text-xs font-semibold text-brand-800">{t.room_title ?? "채팅"}</span>
                  <span className="flex items-center gap-1.5">
                    <b className="min-w-0 flex-1 break-keep text-[14.5px]">{t.title}</b>
                    {t.new > 0 && <span className="whitespace-nowrap rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">새 글 {t.new}</span>}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {threadMeta(t)} · {listTimeLabel(t.last_message_at)}
                  </span>
                  {t.status === "closed" && t.summary && <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[12.5px] text-zinc-800">요약 · {t.summary}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ChatOverlay>
  );
}
