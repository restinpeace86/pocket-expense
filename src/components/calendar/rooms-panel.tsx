"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CalDirectory, MeetingRoom } from "@/lib/calendar/calendar";

// 회의실 예약을 캘린더 안에서(D-234): 휴대폰 = 아래에서 올라오는 시트, PC = 가운데 큰 창. 캘린더 화면은 뒤에 그대로.
// 휴대폰 뒤로 가기 = 시트 닫기(설치 앱·브라우저 모두). 예약 폼·상세는 이 위에 겹쳐 열린다
const RoomBoard = dynamic(() => import("./room-board").then((m) => m.RoomBoard), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-zinc-500">
      <Loader2 className="size-5 animate-spin" aria-label="불러오는 중" />
    </div>
  ),
});

type Props = {
  ws: string;
  admin: boolean;
  today: string;
  date: string;
  room: string | null;
  directory: CalDirectory;
  rooms: MeetingRoom[];
  onClose: () => void;
  onBooked: () => void;
};

const STATE_KEY = "pe_rooms_sheet";

// 버튼·바깥 누르기로 닫을 때는 열 때 넣은 기록 한 칸을 되돌린다(→ popstate → onClose)
function closeSheet(onClose: () => void) {
  if ((window.history.state as Record<string, unknown> | null)?.[STATE_KEY]) window.history.back();
  else onClose();
}

export function RoomsPanel({ onClose, ...p }: Props) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    // 뒤로 가기로 닫기: 열 때 기록 한 칸을 넣고, 뒤로 가기(popstate)면 닫는다
    window.history.pushState({ ...(window.history.state ?? {}), [STATE_KEY]: 1 }, "");
    const onPop = () => latest.current();
    window.addEventListener("popstate", onPop);
    // Esc: 위에 예약 폼·상세 창이 떠 있으면 그 창만 닫히게(여기선 무시)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelectorAll("[aria-modal]").length > 1) return;
      closeSheet(latest.current);
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, []);
  const close = () => closeSheet(onClose);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center md:p-6" onClick={close} role="dialog" aria-modal aria-label="회의실 예약">
      <div
        className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-zinc-50 shadow-xl md:h-auto md:max-h-[90dvh] md:max-w-6xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 md:hidden" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <RoomBoard {...p} initialDate={p.date} initialRoom={p.room} embedded onClose={close} onBooked={p.onBooked} />
        </div>
      </div>
    </div>
  );
}
