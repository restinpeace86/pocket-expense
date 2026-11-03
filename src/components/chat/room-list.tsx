"use client";

import { ArrowLeft, Bell, MessageCirclePlus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listTimeLabel, previewText, roomTitle, type ChatRoomSummary } from "@/lib/chat/format";
import { RoomAvatar } from "./avatar";
import { useChat } from "./chat-app";
import { MemberPicker } from "./member-picker";

// 채팅 목록(카톡 '채팅' 탭): 최근 대화 순, 마지막 메시지·시각·안 읽은 수. 새 메시지가 오면 다시 불러온다
export function RoomList({ base }: { base: string }) {
  const { membership, homeHref, profileHref, supabase, useEvents } = useChat();
  const me = membership.member_id;
  const router = useRouter();
  const pathname = usePathname();
  const [rooms, setRooms] = useState<ChatRoomSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const [notify, setNotify] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // 알림이 꺼져 있으면 켜기 안내(앱을 안 보고 있을 때 새 메시지를 알려 주려면 필요)
    void Promise.resolve().then(() => {
      setNotify(typeof Notification !== "undefined" && Notification.permission !== "granted");
      return load();
    });
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
        <Link href={homeHref} aria-label="워크스페이스로" className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex-1 text-lg font-bold">채팅</h1>
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
      {notify && (
        <Link href={profileHref} className="mx-3 mb-2 flex shrink-0 items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100">
          <Bell className="size-4 shrink-0" />
          <span className="flex-1">알림을 켜면 새 메시지를 바로 알려 드려요</span>
          <span className="font-semibold">켜기 →</span>
        </Link>
      )}
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
