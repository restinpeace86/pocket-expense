"use client";

import { ArrowLeft, Bell, ExternalLink, Loader2, MessageCirclePlus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listTimeLabel, previewText, roomTitle, type ChatRoomSummary } from "@/lib/chat/format";
import { PushHelp, usePushSubscription } from "@/components/push/push-toggle";
import { RoomAvatar } from "./avatar";
import { useChat } from "./chat-app";
import { ChatThemeButton } from "./chat-theme";
import { openChatPopup, useChatPopup } from "./popup";
import { MemberPicker } from "./member-picker";

// 채팅 목록(카톡 '채팅' 탭): 최근 대화 순, 마지막 메시지·시각·안 읽은 수. 새 메시지가 오면 다시 불러온다
export function RoomList({ base }: { base: string }) {
  const { membership, homeHref, supabase, useEvents } = useChat();
  const me = membership.member_id;
  const router = useRouter();
  const pathname = usePathname();
  const [rooms, setRooms] = useState<ChatRoomSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popup = useChatPopup();

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("chat_room_list");
    if (e) return setError(true);
    setError(false);
    setRooms((data as unknown as ChatRoomSummary[]) ?? []);
  }, [supabase]);
  const reload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 250);
  }, [load]);

  useEffect(() => {
    void Promise.resolve().then(load);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);
  useEvents(() => reload());
  // 대화방을 읽으면(경로가 바뀌면) 안 읽은 수를 다시
  useEffect(() => reload(), [pathname, reload]);

  const start = async (ids: string[], title: string | null) => {
    const { data, error: e } =
      ids.length === 1 ? await supabase.rpc("chat_open_direct", { p_member: ids[0] }) : await supabase.rpc("chat_create_group", { p_member_ids: ids, p_title: title ?? undefined });
    if (e || !data) return "대화방을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.";
    setPicking(false);
    router.push(`${base}/${data}`);
    void load();
    return null;
  };

  const shown = (rooms ?? []).filter((r) => {
    if (!q.trim()) return true;
    const t = `${roomTitle(r, me)} ${r.members.map((m) => m.name).join(" ")}`;
    return t.toLowerCase().includes(q.trim().toLowerCase());
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-2">
        {popup ? (
          <span className="w-2" />
        ) : (
          <Link href={homeHref} aria-label="워크스페이스로" className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-zinc-100">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <h1 className="flex-1 text-lg font-bold">채팅</h1>
        {!popup && (
          <button
            type="button"
            onClick={() => openChatPopup(base, pathname)}
            aria-label="채팅 새 창으로 열기"
            title="새 창으로 열기"
            className="hidden size-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-zinc-100 md:inline-flex"
          >
            <ExternalLink className="size-5" />
          </button>
        )}
        <ChatThemeButton />
        <button type="button" onClick={() => setPicking(true)} aria-label="새 채팅" className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-zinc-100">
          <MessageCirclePlus className="size-6" />
        </button>
      </header>
      <div className="shrink-0 px-3 py-2">
        <label className="flex h-10 items-center gap-2 rounded-xl bg-zinc-100 px-3 text-sm text-zinc-500">
          <Search className="size-4 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="채팅방·이름 검색" className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none md:text-sm" />
        </label>
      </div>
      <NotifyBar />
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="채팅방 목록">
        {rooms === null && !error && [0, 1, 2].map((i) => <li key={i} className="mx-3 my-2 h-14 animate-pulse rounded-xl bg-zinc-100" />)}
        {error && (
          <li className="p-6 text-center text-sm text-zinc-600">
            채팅 목록을 불러오지 못했어요.
            <button type="button" onClick={() => void load()} className="ml-1 font-semibold text-brand-700 underline">
              다시 시도
            </button>
          </li>
        )}
        {rooms !== null && !rooms.length && (
          <li className="flex flex-col items-center gap-3 p-8 text-center text-sm text-zinc-600">
            아직 대화가 없어요.
            <button type="button" onClick={() => setPicking(true)} className="min-h-11 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
              새 채팅 시작하기
            </button>
          </li>
        )}
        {shown.map((r) => {
          const href = `${base}/${r.id}`;
          const active = pathname === href;
          const other = r.members.find((m) => m.member_id !== me) ?? null;
          const count = r.kind === "direct" ? null : r.members.length;
          return (
            <li key={r.id}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 px-3 py-2.5 ${active ? "bg-zinc-100" : "hover:bg-zinc-50"}`}>
                <RoomAvatar kind={r.kind} other={other} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-zinc-900">{roomTitle(r, me)}</span>
                    {count !== null && <span className="shrink-0 text-sm text-zinc-400">{count}</span>}
                  </span>
                  <span className="block truncate text-sm text-zinc-500">{previewText(r.last) || (r.kind === "claim" ? "소명서에 대해 이야기해 보세요" : "대화를 시작해 보세요")}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5">
                  <span className="text-xs text-zinc-400">{r.last ? listTimeLabel(r.last.created_at) : ""}</span>
                  {r.unread > 0 && <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{r.unread > 300 ? "300+" : r.unread}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {picking && <MemberPicker mode="new" onClose={() => setPicking(false)} onConfirm={start} />}
    </div>
  );
}

// 알림 켜기 안내(D-203): 앱을 안 보고 있을 때 새 메시지를 알려 주려면 이 기기에서 한 번 허용해야 한다.
// 다른 화면으로 보내지 않고 이 자리에서 바로 켠다. 켜져 있거나 지원하지 않는 브라우저면 숨김, [닫기]는 이 화면에서만
function NotifyBar() {
  const { state, msg, pending, turnOn } = usePushSubscription();
  const [closed, setClosed] = useState(false);
  if (closed || state === "loading" || state === "unsupported" || (state === "on" && !msg)) return null;
  return (
    <div className="mx-3 mb-2 flex shrink-0 items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="region" aria-label="알림 켜기">
      <Bell className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="leading-snug">
          {state === "on"
            ? msg
            : state === "ios-install"
              ? "아이폰은 Safari [공유] → [홈 화면에 추가]로 연 앱에서 알림을 켤 수 있어요."
              : state === "denied"
                ? "알림이 막혀 있어요. 휴대폰(브라우저) 설정 › 알림에서 이 사이트를 허용해 주세요."
                : (msg ?? "알림을 켜면 새 메시지를 바로 알려 드려요")}
        </p>
        {state !== "on" && <PushHelp className="-ml-1.5 text-amber-900" />}
      </div>
      {state === "off" && (
        <button type="button" disabled={pending} onClick={turnOn} className="-my-1 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-amber-400 px-3 font-semibold text-amber-950 hover:bg-amber-300 disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />}
          알림 켜기
        </button>
      )}
      <button type="button" onClick={() => setClosed(true)} aria-label="안내 닫기" className="-my-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-amber-800 hover:bg-amber-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
