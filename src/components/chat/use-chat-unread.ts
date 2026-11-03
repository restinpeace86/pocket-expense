"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeChat } from "./hub";

// 메뉴의 [채팅] 배지(D-203): 처음 값은 서버가, 그 뒤엔 새 메시지·읽음이 오면 다시 센다. null = 메신저 꺼짐(메뉴 숨김)
export function useChatUnread(initial: number | null | undefined, memberId: string): number | null {
  const [count, setCount] = useState<number | null>(initial ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = initial !== null && initial !== undefined;
  // 서버가 새 값을 주면(화면 이동) 그 값으로
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setCount(initial ?? null);
  }
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const { data } = await supabase.rpc("chat_unread_total");
        if (typeof data === "number") setCount(data);
      }, 400);
    };
    const off = subscribeChat(memberId, refresh);
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, memberId]);
  return count;
}
