"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Membership } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";
import { subscribeChat, type ChatEvent } from "./hub";
import { RoomList } from "./room-list";

// 사내 메신저 틀(D-203): 카톡 PC처럼 넓은 화면은 왼쪽 목록 + 오른쪽 대화방, 휴대폰은 목록 ↔ 대화방 한 화면씩
type ChatCtx = {
  membership: Membership;
  homeHref: string;
  profileHref: string;
  supabase: ReturnType<typeof createClient>;
  useEvents: (fn: (e: ChatEvent) => void) => void;
};
const Ctx = createContext<ChatCtx | null>(null);

export function useChat(): ChatCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("ChatApp 안에서만 쓸 수 있어요");
  return c;
}

// 실시간 이벤트 받기(화면이 사라지면 자동으로 끊김). 최신 콜백을 쓰도록 ref로 감싼다
function useChatEvents(memberId: string, fn: (e: ChatEvent) => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => subscribeChat(memberId, (e) => ref.current(e)), [memberId]);
}

export function ChatApp({ membership, homeHref, profileHref, children }: { membership: Membership; homeHref: string; profileHref: string; children: ReactNode }) {
  const pathname = usePathname();
  const base = `/workspace/${membership.company_id}/chat`;
  const inRoom = pathname.startsWith(`${base}/`);
  const supabase = useMemo(() => createClient(), []);
  const value = useMemo<ChatCtx>(
    () => ({ membership, homeHref, profileHref, supabase, useEvents: (fn) => useChatEvents(membership.member_id, fn) }),
    [membership, homeHref, profileHref, supabase],
  );
  return (
    <Ctx.Provider value={value}>
      <div className="flex h-dvh min-h-0 flex-1 bg-white">
        <aside className={`${inRoom ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col border-r border-zinc-200 md:w-80 lg:w-96`}>
          <RoomList base={base} />
        </aside>
        <section className={`${inRoom ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}>{children}</section>
      </div>
    </Ctx.Provider>
  );
}
