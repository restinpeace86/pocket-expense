"use client";

import { ChevronLeft, ChevronRight, DoorOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  addDays,
  boardHours,
  busyRanges,
  dayLabel,
  DAY_SLOTS,
  dragRange,
  isBusy,
  kstIso,
  slotEndOf,
  slotOf,
  slotTime,
  tapRange,
  todayKst,
  type CalDirectory,
  type CalEvent,
  type MeetingRoom,
  type SlotRange,
} from "@/lib/calendar/calendar";
import { createClient } from "@/lib/supabase/client";
import { EventDetail, EventEditor } from "./calendar-view";

// 회의실 예약(D-215, spec/features/calendar.md §13)
// - PC(md 이상): 회의실마다 한 줄, 가로 시간축(기본 08~20시) 위에 잡힌 예약을 가로 막대로
// - 휴대폰: 위에서 회의실을 고르고, 세로 시간축에 잡힌 예약을 세로 막대로
// - 빈 칸을 누르면 그 10분부터 1시간, 끌면(마우스는 바로, 손가락은 살짝 꾹 누른 뒤) 끈 만큼(10분 칸) → 예약 폼
// - 잡힌 칸·지난 시간은 고를 수 없다. 최종 겹침 판단은 DB(같은 방·겹치는 시간 한 건만, ROOM_TAKEN)
type Props = {
  ws: string;
  admin: boolean;
  today: string;
  initialDate: string;
  initialRoom: string | null;
  directory: CalDirectory;
  rooms: MeetingRoom[];
};

export function RoomBoard({ ws, admin, today, initialDate, initialRoom, directory, rooms }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const me = directory.me;
  const nameOf = useMemo(() => new Map(directory.members.map((m) => [m.member_id, m.name])), [directory.members]);
  const [day, setDay] = useState(initialDate);
  const [room, setRoom] = useState(initialRoom && rooms.some((r) => r.id === initialRoom) ? initialRoom : rooms[0].id);
  const [bookings, setBookings] = useState<CalEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState<{ roomId: string; range: SlotRange } | null>(null);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const req = useRef(0);
  const load = useCallback(
    async (d: string) => {
      const id = ++req.current;
      const { data, error } = await supabase.rpc("calendar_room_bookings", { p_starts: kstIso(d, "00:00"), p_ends: kstIso(addDays(d, 1), "00:00") });
      if (id !== req.current) return;
      setFailed(!!error);
      setBookings((data as unknown as CalEvent[] | null) ?? []);
    },
    [supabase],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load(day));
  }, [day, load]);
  // 지난 시간 표시는 1분마다
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  // 주소에 날짜·회의실 기억(새로고침·뒤로 가기)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", day);
    url.searchParams.set("room", room);
    window.history.replaceState(null, "", url.toString());
  }, [day, room]);

  const goDay = (d: string) => {
    setBookings(null);
    setDay(d);
  };
  const list = useMemo(() => bookings ?? [], [bookings]);
  const busyBy = useMemo(() => new Map(rooms.map((r) => [r.id, busyRanges(list, r.id, day)])), [rooms, list, day]);
  const hours = useMemo(() => boardHours([...busyBy.values()].flat()), [busyBy]);
  // 지난 시간(오늘은 지금까지, 지난 날은 하루 전체) — 고를 수 없음
  const pastSlots = day < todayKst(now) ? DAY_SLOTS : day > todayKst(now) ? 0 : slotEndOf(new Date(now).toISOString(), day);
  const blocked = (roomId: string): SlotRange[] => [...(pastSlots ? [{ from: 0, to: pastSlots }] : []), ...(busyBy.get(roomId) ?? [])];

  const pick = (roomId: string, range: SlotRange) => setPicking({ roomId, range });
  const reopen = async (id: string | null) => {
    await load(day);
    if (!id) return setDetail(null);
    const { data } = await supabase.rpc("calendar_event", { p_id: id });
    setDetail(data ? (data as unknown as CalEvent) : null);
  };
  const roomBookings = (roomId: string) => list.filter((e) => e.room_id === roomId);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 pb-32 pt-4 md:pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`${ws}/calendar`} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100" aria-label="캘린더로">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">회의실 예약</h1>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={() => goDay(addDays(day, -1))} aria-label="전날" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <ChevronLeft className="size-5" />
          </button>
          <label className="relative">
            <span className="sr-only">날짜 고르기</span>
            <span className="inline-flex min-h-11 min-w-[8.5rem] items-center justify-center rounded-xl px-2 text-base font-semibold tabular-nums" aria-live="polite">
              {dayLabel(day)}
            </span>
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && goDay(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="날짜 고르기"
            />
          </label>
          <button type="button" onClick={() => goDay(addDays(day, 1))} aria-label="다음 날" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <ChevronRight className="size-5" />
          </button>
          {day !== today && (
            <button type="button" onClick={() => goDay(today)} className="ml-1 min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50">
              오늘
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        <span className="hidden md:inline">빈 칸을 누르면 1시간, 끌면 끈 만큼(10분 단위) 골라져요.</span>
        <span className="md:hidden">빈 시간을 누르면 1시간, 꾹 누른 채 위아래로 끌면 끈 만큼(10분 단위) 골라져요.</span> 예약하면 참석자 캘린더에 회의로 바로 보여요.
      </p>

      {failed && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          예약 현황을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}

      {/* PC: 회의실별 가로 타임라인 */}
      <section className="hidden md:block" aria-label={`${dayLabel(day)} 회의실 예약 현황`}>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <div style={{ minWidth: `${8 + (hours.to - hours.from) * 3.5}rem` }}>
            <div className="flex border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              <div className="w-32 shrink-0 px-3 py-2 font-medium">회의실</div>
              <div className="relative h-8 flex-1">
                {Array.from({ length: hours.to - hours.from }, (_, i) => (
                  <span key={i} className="absolute top-2 -translate-x-1/2 tabular-nums first:translate-x-0" style={{ left: `${(i / (hours.to - hours.from)) * 100}%` }}>
                    {String(hours.from + i).padStart(2, "0")}시
                  </span>
                ))}
              </div>
            </div>
            {rooms.map((r) => (
              <div key={r.id} className="flex border-b border-zinc-100 last:border-b-0">
                <div className="flex w-32 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold">
                  <DoorOpen className="size-4 shrink-0 text-zinc-500" />
                  <span className="truncate">{r.name}</span>
                </div>
                <Track
                  axis="x"
                  label={r.name}
                  hours={hours}
                  blocked={blocked(r.id)}
                  pastSlots={pastSlots}
                  day={day}
                  bookings={roomBookings(r.id)}
                  loading={bookings === null}
                  picked={picking?.roomId === r.id ? picking.range : null}
                  onPick={(range) => pick(r.id, range)}
                  onOpen={setDetail}
                  className="h-16 flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 휴대폰: 회의실 고르기 + 세로 시간 목록 */}
      <section className="flex flex-col gap-3 md:hidden" aria-label={`${dayLabel(day)} 회의실 예약 현황(휴대폰)`}>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="회의실 고르기">
          {rooms.map((r) => {
            const on = r.id === room;
            const n = roomBookings(r.id).length;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRoom(r.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-200 bg-white text-zinc-800"}`}
              >
                {r.name}
                {bookings !== null && <span className={`text-xs font-medium ${on ? "text-white/80" : "text-zinc-500"}`}>{n ? `${n}건` : "비어 있음"}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex rounded-2xl border border-zinc-200 bg-white">
          <div className="relative w-12 shrink-0 border-r border-zinc-100 text-xs text-zinc-500" style={{ height: `${(hours.to - hours.from) * 4}rem` }} aria-hidden>
            {Array.from({ length: hours.to - hours.from }, (_, i) => (
              <span key={i} className="absolute right-1.5 tabular-nums" style={{ top: `calc(${(i / (hours.to - hours.from)) * 100}% + 2px)` }}>
                {String(hours.from + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <Track
            key={room}
            axis="y"
            label={rooms.find((r) => r.id === room)?.name ?? "회의실"}
            hours={hours}
            blocked={blocked(room)}
            pastSlots={pastSlots}
            day={day}
            bookings={roomBookings(room)}
            loading={bookings === null}
            picked={picking?.roomId === room ? picking.range : null}
            onPick={(range) => pick(room, range)}
            onOpen={setDetail}
            className="flex-1"
            style={{ height: `${(hours.to - hours.from) * 4}rem` }}
          />
        </div>
      </section>

      <p className="text-xs text-zinc-500">같은 회의실은 같은 시간에 한 건만 잡혀요. 앞 회의가 끝나는 시각부터 다음 예약을 잡을 수 있어요.</p>

      {picking && (
        <EventEditor
          key={`${picking.roomId}-${picking.range.from}-${picking.range.to}`}
          date={day}
          time={slotTime(picking.range.from)}
          endTime={slotTime(picking.range.to)}
          roomId={picking.roomId}
          rooms={rooms}
          me={me}
          directory={directory}
          nameOf={nameOf}
          supabase={supabase}
          onClose={() => setPicking(null)}
          onSaved={async (id) => {
            setPicking(null);
            await reopen(id);
          }}
        />
      )}
      {editEvent && (
        <EventEditor
          key={editEvent.id}
          event={editEvent}
          rooms={rooms}
          me={me}
          directory={directory}
          nameOf={nameOf}
          supabase={supabase}
          onClose={() => setEditEvent(null)}
          onSaved={async (id) => {
            setEditEvent(null);
            await reopen(id);
          }}
        />
      )}
      {detail && (
        <EventDetail
          event={detail}
          me={me}
          ws={ws}
          admin={admin}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditEvent(detail);
            setDetail(null);
          }}
          onChanged={reopen}
          supabase={supabase}
        />
      )}
    </main>
  );
}

// 한 회의실의 하루 칸. axis x = 가로(PC), y = 세로(휴대폰)
function Track({
  axis,
  label,
  hours,
  blocked,
  pastSlots,
  day,
  bookings,
  loading,
  picked,
  onPick,
  onOpen,
  className = "",
  style,
}: {
  axis: "x" | "y";
  label: string;
  hours: { from: number; to: number };
  blocked: SlotRange[];
  pastSlots: number;
  day: string;
  bookings: CalEvent[];
  loading: boolean;
  picked: SlotRange | null;
  onPick: (r: SlotRange) => void;
  onOpen: (e: CalEvent) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = hours.from * 6;
  const last = hours.to * 6; // 끝(포함 안 함)
  const span = last - first;
  const [sel, setSel] = useState<SlotRange | null>(null);
  const [hover, setHover] = useState(false);
  // open: 잡힌 칸을 눌렀을 때 그 예약(떼면 상세). 막대는 손가락 '가까운 버튼 잡기'에 끌려가지 않도록 칸 계산으로 연다
  const g = useRef<{ anchor: number; active: boolean; moved: boolean; timer: ReturnType<typeof setTimeout> | null; x: number; y: number; id: number; mouse: boolean; open?: CalEvent } | null>(null);
  const handled = useRef(false);
  const bookingAt = (i: number) => bookings.find((b) => b.starts_at && b.ends_at && i >= slotOf(b.starts_at, day) && i < slotEndOf(b.ends_at, day));

  const pos = (from: number, to: number): CSSProperties => {
    const a = ((Math.max(from, first) - first) / span) * 100;
    const b = ((Math.min(to, last) - first) / span) * 100;
    return axis === "x" ? { left: `${a}%`, width: `${b - a}%` } : { top: `${a}%`, height: `${b - a}%` };
  };
  const slotAt = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const f = axis === "x" ? (clientX - r.left) / r.width : (clientY - r.top) / r.height;
    return Math.max(first, Math.min(last - 1, first + Math.floor(f * span)));
  };
  const reset = () => {
    if (g.current?.timer) clearTimeout(g.current.timer);
    g.current = null;
    setSel(null);
  };
  const activate = () => {
    const s = g.current;
    if (!s) return;
    s.active = true;
    s.timer = null;
    try {
      ref.current?.setPointerCapture(s.id);
    } catch {
      // 손가락이 이미 떨어졌으면 무시
    }
    setSel(dragRange(s.anchor, s.anchor, blocked));
    if (!s.mouse) navigator.vibrate?.(10);
  };

  // 손가락으로 끄는 동안엔 화면이 같이 움직이지 않게(꾹 누른 뒤에만)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (g.current?.active) e.preventDefault();
    };
    // 손가락을 떼면서 창(예약 폼·상세)을 열었으면, 뒤따르는 click이 막 열린 창의 바깥(배경)을 눌러 닫지 않게
    const end = (e: TouchEvent) => {
      if (!handled.current) return;
      handled.current = false;
      e.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    return () => {
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("touchend", end);
    };
  }, []);
  useEffect(() => () => void (g.current?.timer && clearTimeout(g.current.timer)), []);

  const shown = sel ?? picked;
  const lines =
    axis === "x"
      ? `repeating-linear-gradient(to right, #e4e4e7 0 1px, transparent 1px calc(100% / ${hours.to - hours.from}))`
      : `repeating-linear-gradient(to bottom, #e4e4e7 0 1px, transparent 1px calc(100% / ${hours.to - hours.from}))`;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${label} 시간표`}
      data-room-track={label}
      className={`relative select-none ${className}`}
      style={{ ...style, backgroundImage: lines, cursor: hover ? "pointer" : "crosshair" }}
      onMouseMove={(e) => setHover(isBusy(blocked, slotAt(e.clientX, e.clientY)) && !!bookingAt(slotAt(e.clientX, e.clientY)))}
      onMouseLeave={() => setHover(false)}
      onPointerDown={(e) => {
        if (e.button !== 0 || loading) return;
        const i = slotAt(e.clientX, e.clientY);
        const mouse = e.pointerType === "mouse";
        if (isBusy(blocked, i)) {
          const b = bookingAt(i);
          if (b) g.current = { anchor: i, active: false, moved: false, timer: null, x: e.clientX, y: e.clientY, id: e.pointerId, mouse, open: b };
          return;
        }
        g.current = { anchor: i, active: false, moved: false, timer: null, x: e.clientX, y: e.clientY, id: e.pointerId, mouse };
        if (mouse) {
          e.preventDefault();
          activate();
        } else g.current.timer = setTimeout(activate, 280);
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s) return;
        if (!s.active) {
          // 꾹 누르기 전에 움직이면 스크롤로 본다
          if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) reset();
          return;
        }
        const i = slotAt(e.clientX, e.clientY);
        if (i !== s.anchor) s.moved = true;
        setSel(dragRange(s.anchor, i, blocked));
      }}
      onPointerUp={() => {
        const s = g.current;
        if (!s) return;
        handled.current = !s.mouse;
        if (s.open) {
          reset();
          return onOpen(s.open);
        }
        const tap = !s.active || !s.moved;
        const r = tap ? tapRange(s.anchor, blocked) : sel;
        reset();
        if (r) onPick(r);
      }}
      onPointerCancel={reset}
    >
      {/* 지난 시간 */}
      {pastSlots > first && <div className="pointer-events-none absolute bg-zinc-100/80" style={{ ...(axis === "x" ? { top: 0, bottom: 0 } : { left: 0, right: 0 }), ...pos(first, pastSlots) }} aria-hidden />}
      {loading && <Loader2 className="absolute left-2 top-2 size-4 animate-spin text-zinc-400" aria-label="불러오는 중" />}
      {bookings.map((b) => {
        const from = slotOf(b.starts_at!, day);
        const to = slotEndOf(b.ends_at!, day);
        if (to <= first || from >= last) return null;
        const time = `${slotTime(from)}~${slotTime(to)}`;
        return (
          <button
            key={b.id}
            type="button"
            tabIndex={0}
            onClick={() => onOpen(b)}
            aria-label={`${time} ${b.title} · ${b.creator_name} 예약`}
            title={`${time} ${b.title} · ${b.creator_name}`}
            className={`pointer-events-none absolute overflow-hidden rounded-lg border border-brand-300 bg-brand-50 px-2 text-left text-xs text-brand-900 shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600 ${axis === "x" ? "inset-y-1.5 py-1" : "inset-x-1.5 py-1"}`}
            style={pos(from, to)}
          >
            <span className="block truncate font-semibold">{b.title}</span>
            <span className="block truncate tabular-nums text-brand-700">
              {time} · {b.creator_name}
            </span>
          </button>
        );
      })}
      {shown && (
        <div
          className={`pointer-events-none absolute flex items-center justify-center rounded-lg border-2 border-dashed border-brand-600 bg-brand-600/15 text-xs font-bold text-brand-800 ${axis === "x" ? "inset-y-1.5" : "inset-x-1.5"}`}
          style={pos(shown.from, shown.to)}
          role="status"
        >
          <span className="truncate px-1 tabular-nums">
            {slotTime(shown.from)}~{slotTime(shown.to)}
          </span>
        </div>
      )}
    </div>
  );
}
