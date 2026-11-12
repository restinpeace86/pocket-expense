"use client";

import { AlarmClock, Check, TreePalm, ChevronDown, ChevronLeft, ChevronRight, DoorOpen, Loader2, MapPin, Plus, Receipt, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { createClaimFromEventAction } from "@/app/workspace/[id]/calendar/actions";
import { claimStatusBadge } from "@/lib/expense/status";
import { formatWon } from "@/lib/format";
import {
  addDays,
  addMinutes,
  attendeeSummary,
  CLAIM_KINDS,
  dayLabel,
  dayTone,
  deadlinesBetween,
  eventOwnerFor,
  eventsOnDay,
  fullTimeLabel,
  holidayMap,
  KIND_LABEL,
  kstDateOf,
  kstIso,
  kstTimeOf,
  monthCells,
  monthDays,
  monthTitle,
  nextHour,
  personColor,
  placeLabel,
  roomConflict,
  saveErrorText,
  shiftMonth,
  TIME_OPTIONS,
  timeLabelOn,
  weekdayLabel,
  WEEKDAY_HEADERS,
  type CalDirectory,
  type CalEvent,
  type CalKind,
  type Deadline,
  type EventClaim,
  type Holiday,
  type MeetingRoom,
} from "@/lib/calendar/calendar";
import { createClient } from "@/lib/supabase/client";
import { deleteMeetingFile, MeetingFilesEdit, MeetingFilesView, uploadMeetingFiles } from "./meeting-files";
import { RoomsPanel } from "./rooms-panel";

// 사내 캘린더(D-206, spec/features/calendar.md)
// - PC(md 이상) = 월 달력(월요일 시작), 휴대폰 = 그 달 날짜별 목록. 같은 데이터를 CSS로만 바꿔 보여 준다(local-open-spaces 파트너 월간 화면과 같은 방식)
// - 기본은 내 일정만. [사람 선택]에서 고른 사람의 일정을 겹쳐 본다(사람마다 색, 고른 사람은 DB에 기억)
// - 일요일·공휴일 빨강(공휴일 이름 작게), 토요일 파랑. 마감일(청구·세무)은 굵은 주황 + 시계 표시
type Props = {
  ws: string;
  admin: boolean;
  today: string;
  initialMonth: string;
  initialDate: string | null;
  initialEventId: string | null;
  directory: CalDirectory;
  initialSelected: string[];
  initialShowDeadlines: boolean;
  initialEvents: CalEvent[];
  holidays: Holiday[];
  rooms: MeetingRoom[]; // 회의실(D-207). 없으면 회의실 칸·[회의실 예약] 숨김
  initialRooms?: { date: string; room: string | null } | null; // ?rooms=날짜(&room=) — 들어오면 회의실 예약을 바로 연다(D-234)
};

const TONE_TEXT = { holiday: "text-red-600", sun: "text-red-600", sat: "text-blue-600" } as const;

export function CalendarView(props: Props) {
  const { ws, admin, today, directory, holidays, rooms } = props;
  const me = directory.me;
  const supabase = useMemo(() => createClient(), []);
  const [month, setMonth] = useState(props.initialMonth);
  const [selected, setSelected] = useState<string[]>(props.initialSelected);
  const [showDeadlines, setShowDeadlines] = useState(props.initialShowDeadlines);
  const [events, setEvents] = useState<CalEvent[]>(props.initialEvents);
  // 승인된 휴가(D-241): 다른 직원에게는 "휴가"만, 관리자·본인은 종류까지(DB 함수가 정함). 근태 꺼진 회사는 빈 목록
  const [leaves, setLeaves] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [editing, setEditing] = useState<{ event?: CalEvent; date?: string; time?: string; roomId?: string } | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState<{ date: string; room: string | null } | null>(props.rooms.length ? (props.initialRooms ?? null) : null);

  const hmap = useMemo(() => holidayMap(holidays), [holidays]);
  const holidayDays = useMemo(() => holidays.map((h) => h.day), [holidays]);
  const cells = useMemo(() => monthCells(month), [month]);
  const from = cells[0].date;
  const to = cells[cells.length - 1].date;
  const deadlines = useMemo(() => (showDeadlines ? deadlinesBetween(from, to, holidayDays, admin) : []), [showDeadlines, from, to, holidayDays, admin]);
  const deadlinesByDay = useMemo(() => {
    const m = new Map<string, Deadline[]>();
    for (const d of [...leaves, ...deadlines]) m.set(d.date, [...(m.get(d.date) ?? []), d]);
    return m;
  }, [deadlines, leaves]);
  const deadlineHref = (d: Deadline) => (d.kind === "leave" ? (admin ? `${ws}/admin/attendance` : `${ws}/employee/vacation`) : d.kind === "tax" ? `${ws}/admin/export` : admin ? `${ws}/admin/claims` : `${ws}/employee/settlements`);
  const loadLeaves = useCallback(
    async (f: string, t: string, ids: string[]) => {
      const { data } = await supabase.rpc("calendar_leaves_range", { p_from: f, p_to: t, p_members: ids });
      const rows = (data as unknown as { name: string; label: string; start_date: string; end_date: string; unit: string; start_time: string | null; hours: number | null }[] | null) ?? [];
      const out: Deadline[] = [];
      for (const l of rows) {
        for (let d = l.start_date; d <= l.end_date && d <= t; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
          if (d >= f) out.push({ date: d, kind: "leave", label: `${l.name} ${l.label}`, sub: l.unit === "hour" ? `${l.start_time}부터 ${l.hours}시간` : "종일" });
        }
      }
      setLeaves(out);
    },
    [supabase],
  );
  useEffect(() => {
    void Promise.resolve().then(() => loadLeaves(from, to, selected));
  }, [from, to, selected, loadLeaves]);

  // 달·고른 사람이 바뀌면 다시 불러온다(늦게 온 옛 응답은 버림)
  const req = useRef(0);
  const reload = useCallback(
    async (m: string = month, ids: string[] = selected) => {
      const id = ++req.current;
      const c = monthCells(m);
      setLoading(true);
      const { data, error: e } = await supabase.rpc("calendar_events_range", { p_from: c[0].date, p_to: c[c.length - 1].date, p_members: ids });
      if (id !== req.current) return;
      setLoading(false);
      if (e) return setError("일정을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      setError(null);
      setEvents((data as unknown as CalEvent[]) ?? []);
    },
    [supabase, month, selected],
  );
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void reload(month, selected);
  }, [month, selected, reload]);

  // 주소에 달 기억(새로고침·뒤로 가기)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("month", month);
    url.searchParams.delete("date");
    url.searchParams.delete("event");
    url.searchParams.delete("rooms");
    url.searchParams.delete("room");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [month]);

  // 고른 사람·마감일 보기는 DB에 기억(다른 기기에서도 같게) — 잠깐 모았다가 한 번
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePrefs = (ids: string[], dl: boolean) => {
    if (prefTimer.current) clearTimeout(prefTimer.current);
    // rpc는 then을 불러야 실제로 보낸다
    prefTimer.current = setTimeout(() => void supabase.rpc("calendar_save_prefs", { p_member_ids: ids, p_show_deadlines: dl }).then(() => undefined), 600);
  };
  const changeSelected = (ids: string[]) => {
    const next = ids.length ? ids : [me];
    setSelected(next);
    savePrefs(next, showDeadlines);
  };
  const toggleDeadlines = (v: boolean) => {
    setShowDeadlines(v);
    savePrefs(selected, v);
  };

  // 휴대폰 목록: 처음 열면 오늘(또는 알림에서 온 날짜) 줄로
  // (화면 이동 직후 브라우저가 맨 위로 되돌리는 것보다 뒤에 하도록 한 박자 늦게)
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current) return;
    scrolled.current = true;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const target = props.initialDate ?? (month === today.slice(0, 7) ? today : null);
    if (!target) return;
    const t = setTimeout(() => document.getElementById(`day-${target}`)?.scrollIntoView({ block: "start" }), 80);
    return () => clearTimeout(t);
  }, [props.initialDate, month, today]);

  // 알림방 [캘린더에서 보기] → 그 일정 상세
  useEffect(() => {
    if (!props.initialEventId) return;
    const found = props.initialEvents.find((e) => e.id === props.initialEventId);
    if (found) return void Promise.resolve().then(() => setDetail(found));
    void supabase.rpc("calendar_event", { p_id: props.initialEventId }).then(({ data }) => data && setDetail(data as unknown as CalEvent));
  }, [props.initialEventId, props.initialEvents, supabase]);

  const refreshAfterChange = async (openId?: string | null) => {
    await reload();
    if (openId) {
      const { data } = await supabase.rpc("calendar_event", { p_id: openId });
      setDetail(data ? (data as unknown as CalEvent) : null);
    } else setDetail(null);
  };

  const goMonth = (m: string) => setMonth(m);
  const nameOf = useMemo(() => new Map(directory.members.map((m) => [m.member_id, m.name])), [directory.members]);
  const othersCount = selected.filter((x) => x !== me).length;

  // 회의실 예약(D-215 → D-234 캘린더 안 시트·창) — 보고 있는 달이 이번 달이면 오늘, 아니면 그 달 1일
  // 회의실 창 화면은 미리 받아 둔다(처음 열 때 기다림 없게)
  useEffect(() => {
    if (rooms.length) void import("./room-board");
  }, [rooms.length]);
  const openRooms = () => setRoomsOpen({ date: month === today.slice(0, 7) ? today : `${month}-01`, room: null });
  const peopleButtonLabel = othersCount ? `사람 선택 (${selected.length})` : "사람 선택";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 pb-32 pt-4 md:pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">캘린더</h1>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={() => goMonth(shiftMonth(month, -1))} aria-label="이전 달" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-[7.5rem] text-center text-base font-semibold tabular-nums" aria-live="polite">
            {monthTitle(month)}
          </span>
          <button type="button" onClick={() => goMonth(shiftMonth(month, 1))} aria-label="다음 달" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              goMonth(today.slice(0, 7));
              setTimeout(() => document.getElementById(`day-${today}`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
            }}
            className="ml-1 min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
          >
            오늘
          </button>
          {rooms.length > 0 && (
            <button type="button" onClick={openRooms} className="ml-2 hidden min-h-11 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50 md:inline-flex">
              <DoorOpen className="size-4" />
              회의실 예약
            </button>
          )}
          <button type="button" onClick={() => setEditing({ date: undefined })} className="ml-2 hidden min-h-11 items-center gap-1 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 md:inline-flex">
            <Plus className="size-4" />
            일정
          </button>
        </div>
      </div>

      {/* 휴대폰: 사람 선택 버튼 + 마감일 보기 */}
      <div className="flex items-center gap-2 md:hidden">
        <button type="button" onClick={() => setPeopleOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium">
          <Users className="size-4" />
          {peopleButtonLabel}
          <ChevronDown className="size-4 text-zinc-500" />
        </button>
        {rooms.length > 0 && (
          <button type="button" onClick={openRooms} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium">
            <DoorOpen className="size-4" />
            회의실 예약
          </button>
        )}
        <DeadlineToggle checked={showDeadlines} onChange={toggleDeadlines} />
        {loading && <Loader2 className="ml-auto size-4 animate-spin text-zinc-500" aria-label="불러오는 중" />}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex min-h-0 gap-4">
        <aside className="hidden w-60 shrink-0 flex-col gap-3 md:flex">
          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
            <PeoplePanel directory={directory} selected={selected} onChange={changeSelected} />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
            <DeadlineToggle checked={showDeadlines} onChange={toggleDeadlines} />
            {loading && <Loader2 className="ml-auto size-4 animate-spin text-zinc-500" aria-label="불러오는 중" />}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {/* PC: 월 달력 */}
          <div className="hidden md:block">
            <MonthGrid
              cells={cells}
              today={today}
              hmap={hmap}
              events={events}
              selected={selected}
              me={me}
              deadlinesByDay={deadlinesByDay}
              deadlineHref={deadlineHref}
              onOpen={setDetail}
              onDay={setDayOpen}
              onAdd={(d) => setEditing({ date: d })}
            />
          </div>
          {/* 휴대폰: 날짜별 목록 */}
          <ol className="flex flex-col gap-2 md:hidden" aria-label={`${monthTitle(month)} 날짜별 일정`}>
            {monthDays(month).map((d) => (
              <li key={d} id={`day-${d}`} className="scroll-mt-20">
                <DayCard
                  date={d}
                  today={today}
                  hmap={hmap}
                  items={eventsOnDay(events, d)}
                  deadlines={deadlinesByDay.get(d) ?? []}
                  selected={selected}
                  me={me}
                  deadlineHref={deadlineHref}
                  onOpen={setDetail}
                  onAdd={() => setEditing({ date: d })}
                />
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 휴대폰: 일정 만들기 */}
      <button
        type="button"
        onClick={() => setEditing({ date: undefined })}
        aria-label="일정 만들기"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 inline-flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 md:hidden"
      >
        <Plus className="size-7" />
      </button>

      {peopleOpen && (
        <Sheet title="사람 선택" onClose={() => setPeopleOpen(false)}>
          <PeoplePanel directory={directory} selected={selected} onChange={changeSelected} />
          <button type="button" onClick={() => setPeopleOpen(false)} className="mt-3 min-h-12 w-full rounded-xl bg-brand-600 font-semibold text-white">
            완료
          </button>
        </Sheet>
      )}

      {dayOpen && (
        <Sheet title={dayLabel(dayOpen)} onClose={() => setDayOpen(null)}>
          <DayCard
            date={dayOpen}
            today={today}
            hmap={hmap}
            items={eventsOnDay(events, dayOpen)}
            deadlines={deadlinesByDay.get(dayOpen) ?? []}
            selected={selected}
            me={me}
            deadlineHref={deadlineHref}
            onOpen={(e) => {
              setDayOpen(null);
              setDetail(e);
            }}
            onAdd={() => {
              const d = dayOpen;
              setDayOpen(null);
              setEditing({ date: d });
            }}
            bare
          />
        </Sheet>
      )}


      {roomsOpen && (
        <RoomsPanel
          ws={ws}
          admin={admin}
          today={today}
          date={roomsOpen.date}
          room={roomsOpen.room}
          directory={directory}
          rooms={rooms}
          onClose={() => setRoomsOpen(null)}
          onBooked={() => void reload()}
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
            setEditing({ event: detail });
            setDetail(null);
          }}
          onChanged={(openId) => refreshAfterChange(openId)}
          supabase={supabase}
        />
      )}

      {editing && (
        <EventEditor
          ws={ws}
          key={editing.event?.id ?? `new-${editing.date ?? ""}-${editing.roomId ?? ""}`}
          event={editing.event}
          date={editing.date}
          time={editing.time}
          roomId={editing.roomId}
          rooms={rooms}
          me={me}
          directory={directory}
          nameOf={nameOf}
          supabase={supabase}
          onClose={() => setEditing(null)}
          onSaved={async (id, d) => {
            setEditing(null);
            if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7));
            else await reload();
            const { data } = await supabase.rpc("calendar_event", { p_id: id });
            if (data) setDetail(data as unknown as CalEvent);
          }}
        />
      )}
    </main>
  );
}

function DeadlineToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-orange-600" />
      <span className="font-medium">마감일 보기</span>
    </label>
  );
}

// ── 사람 고르기: 부서별 접이식 목록 ───────────────────────────────────────────
function PeoplePanel({ directory, selected, onChange }: { directory: CalDirectory; selected: string[]; onChange: (ids: string[]) => void }) {
  const me = directory.me;
  const [q, setQ] = useState("");
  const sel = new Set(selected);
  const groups = useMemo(() => {
    const byDept = new Map<string | null, CalDirectory["members"]>();
    for (const m of directory.members) {
      const k = m.department_id && directory.departments.some((d) => d.id === m.department_id) ? m.department_id : null;
      byDept.set(k, [...(byDept.get(k) ?? []), m]);
    }
    const list = directory.departments.filter((d) => byDept.has(d.id)).map((d) => ({ id: d.id as string | null, name: d.name, members: byDept.get(d.id)! }));
    if (byDept.has(null)) list.push({ id: null, name: "부서 없음", members: byDept.get(null)! });
    return list;
  }, [directory]);
  const query = q.trim().toLowerCase();
  const toggle = (id: string) => onChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const toggleGroup = (ids: string[], on: boolean) => onChange(on ? [...new Set([...selected, ...ids])] : selected.filter((x) => !ids.includes(x)));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">사람 선택</p>
        <button type="button" onClick={() => onChange([me])} className="min-h-9 rounded-lg px-2 text-xs font-medium text-brand-700 hover:bg-brand-50">
          나만 보기
        </button>
      </div>
      <p className="text-xs text-zinc-500">체크한 사람의 일정이 겹쳐 보여요.</p>
      {directory.members.length > 8 && (
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-2.5">
          <Search className="size-4 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 검색" aria-label="이름 검색" className="min-h-10 min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" />
        </label>
      )}
      <div className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto md:max-h-[60vh]">
        {groups.map((g) => {
          const shown = query ? g.members.filter((m) => m.name.toLowerCase().includes(query)) : g.members;
          if (!shown.length) return null;
          const ids = g.members.map((m) => m.member_id);
          const on = ids.filter((x) => sel.has(x)).length;
          return (
            <details key={g.id ?? "none"} open className="group">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                <label className="inline-flex items-center gap-1 text-xs text-zinc-500" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`${g.name} 전체`}
                    checked={on === ids.length}
                    ref={(el) => {
                      if (el) el.indeterminate = on > 0 && on < ids.length;
                    }}
                    onChange={(e) => toggleGroup(ids, e.target.checked)}
                    className="size-4"
                  />
                  전체
                </label>
              </summary>
              <ul className="ml-5 flex flex-col">
                {shown.map((m) => (
                  <li key={m.member_id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm hover:bg-zinc-50">
                      <input type="checkbox" checked={sel.has(m.member_id)} onChange={() => toggle(m.member_id)} className="size-4" />
                      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${personColor(m.member_id, me).dot}`} />
                      <span className="min-w-0 flex-1 truncate">
                        {m.name}
                        {m.position && <span className="ml-1 text-xs text-zinc-500">{m.position}</span>}
                      </span>
                      {m.member_id === me && <span className="rounded bg-zinc-200 px-1 text-[11px] text-zinc-700">나</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

// ── 마감일 한 줄(굵게, 눈에 띄게) ─────────────────────────────────────────────
function DeadlineChip({ d, href, compact = false }: { d: Deadline; href: string; compact?: boolean }) {
  const leave = d.kind === "leave";
  const Icon = leave ? TreePalm : AlarmClock;
  return (
    <Link
      href={href}
      data-cal-leave={leave ? "" : undefined}
      className={`flex items-center gap-1 rounded-md ${leave ? "border border-teal-300 bg-teal-50 font-semibold text-teal-900 hover:bg-teal-100" : "border-2 border-orange-400 bg-orange-50 font-extrabold text-orange-800 hover:bg-orange-100"} ${compact ? "px-1 py-0.5 text-[11px]" : "min-h-11 px-2.5 py-1.5 text-sm"}`}
    >
      <Icon className={compact ? "size-3 shrink-0" : "size-4 shrink-0"} />
      <span className="min-w-0 truncate">
        {d.label}
        {!compact && <span className={`ml-1.5 font-semibold ${leave ? "text-teal-700" : "text-orange-700"}`}>· {d.sub}</span>}
      </span>
    </Link>
  );
}

function isDeclinedFor(e: CalEvent, owner: string) {
  return e.attendees.find((a) => a.member_id === owner)?.response === "declined";
}

// ── PC 월 달력 ───────────────────────────────────────────────────────────────
function MonthGrid({
  cells,
  today,
  hmap,
  events,
  selected,
  me,
  deadlinesByDay,
  deadlineHref,
  onOpen,
  onDay,
  onAdd,
}: {
  cells: { date: string; inMonth: boolean }[];
  today: string;
  hmap: Map<string, string>;
  events: CalEvent[];
  selected: string[];
  me: string;
  deadlinesByDay: Map<string, Deadline[]>;
  deadlineHref: (d: Deadline) => string;
  onOpen: (e: CalEvent) => void;
  onDay: (d: string) => void;
  onAdd: (d: string) => void;
}) {
  const MAX = 3;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {WEEKDAY_HEADERS.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-semibold ${i === 5 ? "text-blue-600" : i === 6 ? "text-red-600" : "text-zinc-500"}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const tone = dayTone(c.date, hmap);
          const hol = hmap.get(c.date);
          const dls = deadlinesByDay.get(c.date) ?? [];
          const items = eventsOnDay(events, c.date);
          const room = Math.max(0, MAX - dls.length);
          const more = items.length - room;
          const isToday = c.date === today;
          return (
            <div key={c.date} className={`group relative flex min-h-32 min-w-0 flex-col gap-1 border-zinc-200 p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < cells.length - 7 ? "border-b" : ""} ${c.inMonth ? "" : "bg-zinc-50/70"}`}>
              <div className="flex min-w-0 items-center gap-1 pr-6">
                <button
                  type="button"
                  onClick={() => onDay(c.date)}
                  aria-label={`${dayLabel(c.date)}${hol ? ` ${hol}` : ""} 일정 보기`}
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums hover:ring-2 hover:ring-zinc-200 ${
                    isToday ? "bg-brand-600 font-bold text-white" : `${tone ? TONE_TEXT[tone] : "text-zinc-800"} ${tone === "holiday" || tone === "sun" ? "font-semibold" : ""}`
                  } ${c.inMonth ? "" : "opacity-50"}`}
                >
                  {Number(c.date.slice(8, 10))}
                </button>
                <button
                  type="button"
                  onClick={() => onAdd(c.date)}
                  aria-label={`${dayLabel(c.date)} 일정 만들기`}
                  className="absolute right-1 top-1.5 inline-flex size-6 items-center justify-center rounded-md text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {hol && <p className={`-mt-0.5 truncate px-0.5 text-[11px] font-semibold leading-tight text-red-600 ${c.inMonth ? "" : "opacity-50"}`}>{hol}</p>}
              <ul className="flex min-w-0 flex-col gap-0.5">
                {dls.map((d) => (
                  <li key={d.kind}>
                    <DeadlineChip d={d} href={deadlineHref(d)} compact />
                  </li>
                ))}
                {items.slice(0, room).map((e) => {
                  const owner = eventOwnerFor(e, selected);
                  const color = personColor(owner, me);
                  const declined = isDeclinedFor(e, owner);
                  const t = timeLabelOn(e, c.date);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(e)}
                        title={`${t} ${e.title}`}
                        className={`flex w-full min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] leading-tight hover:brightness-95 ${
                          t === "종일" ? `border ${color.chip}` : "hover:bg-zinc-100"
                        } ${declined ? "opacity-50" : ""}`}
                      >
                        {t !== "종일" && <span aria-hidden className={`size-2 shrink-0 rounded-full ${color.dot}`} />}
                        {t !== "종일" && <span className="shrink-0 tabular-nums text-zinc-500">{t.replace(/~.*$/, "") || "~"}</span>}
                        <span className={`min-w-0 truncate font-medium ${declined ? "line-through" : ""}`}>{e.title}</span>
                      </button>
                    </li>
                  );
                })}
                {more > 0 && (
                  <li>
                    <button type="button" onClick={() => onDay(c.date)} className="w-full rounded-md px-1 py-0.5 text-left text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100">
                      +{more}개
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 하루 카드(휴대폰 목록 한 줄 / PC 날짜 칸을 눌렀을 때) ──────────────────────
function DayCard({
  date,
  today,
  hmap,
  items,
  deadlines,
  selected,
  me,
  deadlineHref,
  onOpen,
  onAdd,
  bare = false,
}: {
  date: string;
  today: string;
  hmap: Map<string, string>;
  items: CalEvent[];
  deadlines: Deadline[];
  selected: string[];
  me: string;
  deadlineHref: (d: Deadline) => string;
  onOpen: (e: CalEvent) => void;
  onAdd: () => void;
  bare?: boolean;
}) {
  const tone = dayTone(date, hmap);
  const hol = hmap.get(date);
  const isToday = date === today;
  const empty = !items.length && !deadlines.length;
  return (
    <div className={bare ? "flex flex-col gap-2" : `flex flex-col gap-2 rounded-2xl border bg-white px-3 py-2.5 ${isToday ? "border-brand-400 ring-1 ring-brand-300" : "border-zinc-200"}`}>
      {!bare && (
        <div className="flex min-h-8 items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${tone ? TONE_TEXT[tone] : "text-zinc-900"}`}>
            {Number(date.slice(5, 7))}월 {Number(date.slice(8, 10))}일 ({weekdayLabel(date)})
          </span>
          {hol && <span className="text-xs font-medium text-red-600">{hol}</span>}
          {isToday && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">오늘</span>}
          <button type="button" onClick={onAdd} aria-label={`${dayLabel(date)} 일정 만들기`} className="ml-auto inline-flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <Plus className="size-4" />
          </button>
        </div>
      )}
      {bare && hol && <p className="text-sm font-medium text-red-600">{hol}</p>}
      {deadlines.map((d) => (
        <DeadlineChip key={d.kind} d={d} href={deadlineHref(d)} />
      ))}
      {items.map((e) => {
        const owner = eventOwnerFor(e, selected);
        const color = personColor(owner, me);
        const declined = isDeclinedFor(e, owner);
        return (
          <button key={e.id} type="button" onClick={() => onOpen(e)} className={`flex min-h-11 w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-zinc-50 ${declined ? "opacity-60" : ""}`}>
            <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${color.dot}`} />
            <span className="w-[5.5rem] shrink-0 pt-px text-sm tabular-nums text-zinc-600">{timeLabelOn(e, date)}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-semibold text-zinc-900 ${declined ? "line-through" : ""}`}>{e.title}</span>
              <span className="block truncate text-xs text-zinc-500">
                {KIND_LABEL[e.kind]}
                {e.attendees.length > 1 && ` · ${attendeeSummary(e)}`}
                {placeLabel(e) && ` · ${placeLabel(e)}`}
              </span>
            </span>
          </button>
        );
      })}
      {empty && <p className="px-1 text-sm text-zinc-400">일정 없음</p>}
      {bare && (
        <button type="button" onClick={onAdd} className="mt-1 inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          <Plus className="size-4" />이 날짜에 일정 만들기
        </button>
      )}
    </div>
  );
}

// ── 아래에서 올라오는 창(휴대폰) / 가운데 창(PC) ────────────────────────────────
export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-6" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:rounded-2xl ${wide ? "md:max-w-xl" : "md:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-zinc-100 pl-4 pr-2">
          <h2 className="min-w-0 flex-1 truncate font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

const RESPONSE_LABEL = { pending: "대기", accepted: "참석", declined: "불참" } as const;
const RESPONSE_CLS = { pending: "bg-zinc-100 text-zinc-600", accepted: "bg-emerald-100 text-emerald-800", declined: "bg-red-100 text-red-700" } as const;

// ── 일정 상세 ────────────────────────────────────────────────────────────────
export function EventDetail({
  event: e,
  me,
  ws,
  admin,
  onClose,
  onEdit,
  onChanged,
  supabase,
}: {
  event: CalEvent;
  me: string;
  ws: string;
  admin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (openId: string | null) => Promise<void>;
  supabase: ReturnType<typeof createClient>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = e.attendees.find((a) => a.member_id === me);
  const respond = async (r: "accepted" | "declined") => {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("calendar_respond", { p_id: e.id, p_response: r });
    setBusy(false);
    if (error) return setErr("응답하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    await onChanged(e.id);
  };
  const remove = async () => {
    if (!window.confirm(e.files?.length ? `이 일정을 지울까요? 참석자 캘린더에서도 사라지고, 올린 회의 자료 ${e.files.length}개도 함께 지워져요.` : "이 일정을 지울까요? 참석자 캘린더에서도 사라져요.")) return;
    setBusy(true);
    const paths = (e.files ?? []).map((f) => f.path);
    const { error } = await supabase.rpc("calendar_delete_event", { p_id: e.id });
    // 회의를 지우면(취소) 자료 파일도 바로 지운다(자료 줄은 DB가 함께 지움, 못 지운 파일은 새벽 정리 — D-217)
    if (!error && paths.length) await supabase.storage.from("meeting-files").remove(paths);
    setBusy(false);
    if (error) return setErr(saveErrorText(error.message));
    await onChanged(null);
  };
  return (
    <Sheet title="일정" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{KIND_LABEL[e.kind]}</span>
          <h3 className="mt-1.5 break-words text-lg font-bold">{e.title}</h3>
          <p className="mt-0.5 text-sm text-zinc-700">{fullTimeLabel(e)}</p>
          {e.room_name && (
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-zinc-800">
              <DoorOpen className="size-4 shrink-0 text-zinc-400" />
              {e.room_name}
            </p>
          )}
          {e.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-zinc-700">
              <MapPin className="size-4 shrink-0 text-zinc-400" />
              {e.location}
            </p>
          )}
        </div>
        {e.agenda && (
          <div>
            <p className="mb-1 text-sm font-semibold">회의 안건</p>
            <p className="whitespace-pre-line break-words rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-zinc-900">{e.agenda}</p>
          </div>
        )}
        <MeetingFilesView files={e.files ?? []} supabase={supabase} />
        {e.memo && <p className="whitespace-pre-line break-words rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">{e.memo}</p>}
        <div>
          <p className="mb-1 text-sm font-semibold">참석자 {e.attendees.length}</p>
          <ul className="flex flex-col">
            {e.attendees.map((a) => (
              <li key={a.member_id} className="flex min-h-9 items-center gap-2 text-sm">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${personColor(a.member_id, me).dot}`} />
                <span className="min-w-0 flex-1 truncate">
                  {a.name}
                  {a.status === "inactive" && <span className="text-zinc-500">(퇴사)</span>}
                  {a.member_id === e.created_by && <span className="ml-1 text-xs text-zinc-500">만든 사람</span>}
                  {a.member_id === me && <span className="ml-1 rounded bg-zinc-200 px-1 text-[11px] text-zinc-700">나</span>}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RESPONSE_CLS[a.response]}`}>{RESPONSE_LABEL[a.response]}</span>
              </li>
            ))}
          </ul>
        </div>
        {CLAIM_KINDS.includes(e.kind) && <EventClaims event={e} me={me} ws={ws} admin={admin} supabase={supabase} />}
        {e.kind === "meeting" && !e.all_day && <p className="text-xs text-zinc-500">회의 시작 10분 전에 참석자(불참 제외)의 채팅 [알림]방으로 안내가 가요.</p>}
        {err && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </p>
        )}
        {e.mine ? (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-12 flex-1 rounded-xl border border-red-200 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              삭제
            </button>
            <button type="button" disabled={busy} onClick={onEdit} className="min-h-12 flex-[2] rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              수정
            </button>
          </div>
        ) : mine ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond("declined")}
              aria-pressed={mine.response === "declined"}
              className={`min-h-12 flex-1 rounded-xl border font-semibold disabled:opacity-50 ${mine.response === "declined" ? "border-red-600 bg-red-600 text-white" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"}`}
            >
              불참
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond("accepted")}
              aria-pressed={mine.response === "accepted"}
              className={`min-h-12 flex-1 rounded-xl border font-semibold disabled:opacity-50 ${mine.response === "accepted" ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"}`}
            >
              참석
            </button>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

// ── 이 일정 경비(D-210): 출장·회의 일정에서 [경비 올리기] + 묶인 결의서 ─────────────────
// 직원은 내 결의서만, 관리자는 다른 사람이 올린 결의서도(작성 중 제외). 올리기는 참석자(불참 제외)만
function EventClaims({ event: e, me, ws, admin, supabase }: { event: CalEvent; me: string; ws: string; admin: boolean; supabase: ReturnType<typeof createClient> }) {
  const [list, setList] = useState<EventClaim[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    let alive = true;
    void supabase.rpc("calendar_event_claims", { p_event_id: e.id }).then(({ data }) => alive && setList((data as unknown as EventClaim[] | null) ?? []));
    return () => {
      alive = false;
    };
  }, [e.id, supabase]);
  const mine = e.attendees.find((a) => a.member_id === me);
  const canAdd = !!mine && mine.response !== "declined";
  if (!canAdd && !admin && !list?.length) return null;
  const label = e.kind === "trip" ? "출장 경비 올리기" : "회의 경비 올리기";
  const hrefOf = (c: EventClaim) =>
    c.mine ? (c.status === "draft" || c.status === "rejected" ? `${ws}/employee/claims/${c.id}/edit` : `${ws}/employee/claims/${c.id}`) : `${ws}/admin/claims/${c.id}`;
  const add = () =>
    start(async () => {
      setErr(null);
      const r = await createClaimFromEventAction(e.id);
      if (r?.error) setErr(r.error);
    });
  const total = (list ?? []).reduce((n, c) => n + c.total_amount, 0);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3" aria-label="이 일정 경비">
      <div className="flex items-center gap-2">
        <Receipt className="size-4 shrink-0 text-zinc-500" />
        <p className="flex-1 text-sm font-semibold">이 일정 경비{list && list.length > 0 && <span className="ml-1 font-normal text-zinc-600">{list.length}건 · {formatWon(total)}</span>}</p>
      </div>
      {list === null ? (
        <Loader2 className="size-4 animate-spin text-zinc-400" aria-label="불러오는 중" />
      ) : list.length ? (
        <ul className="flex flex-col">
          {list.map((c) => {
            const badge = claimStatusBadge(c.status);
            return (
              <li key={c.id}>
                <Link href={hrefOf(c)} className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-zinc-50">
                  <span className="min-w-0 flex-1 truncate">
                    {c.title || "제목 없는 결의서"}
                    {!c.mine && <span className="ml-1 text-xs text-zinc-500">{c.member_name}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-800">{formatWon(c.total_amount)}</span>
                  <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">아직 이 일정으로 올린 경비가 없어요.</p>
      )}
      {canAdd && (
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-brand-300 bg-brand-50 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {label}
        </button>
      )}
      {canAdd && <p className="text-xs text-zinc-500">{e.kind === "trip" ? "출장지·기간·목적이 채워진 출장 결의서가 만들어져요." : "회의 목적·참석자가 채워진 결의서가 만들어져요. 카테고리는 골라 주세요."}</p>}
      {err && (
        <p role="alert" className="text-sm text-red-700">
          {err}
        </p>
      )}
    </section>
  );
}

// ── 일정 만들기·고치기 ─────────────────────────────────────────────────────────
const KINDS: CalKind[] = ["meeting", "outside", "trip", "other"];

export function EventEditor({
  ws,
  event,
  date,
  time,
  endTime,
  roomId: initialRoom,
  rooms,
  me,
  directory,
  nameOf,
  supabase,
  onClose,
  onSaved,
}: {
  ws: string;
  event?: CalEvent;
  date?: string;
  time?: string;
  endTime?: string; // 회의실 예약 화면에서 끌어 고른 끝 시각(D-215)
  roomId?: string;
  rooms: MeetingRoom[];
  me: string;
  directory: CalDirectory;
  nameOf: Map<string, string>;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: (id: string, date: string) => Promise<void>;
}) {
  const nh = nextHour();
  const startDefault = date ? { date, time: time ?? "10:00" } : nh;
  const init = event
    ? event.all_day
      ? { sDate: event.start_date!, sTime: "10:00", eDate: event.end_date!, eTime: "11:00" }
      : { sDate: kstDateOf(event.starts_at!), sTime: kstTimeOf(event.starts_at!), eDate: kstDateOf(event.ends_at!), eTime: kstTimeOf(event.ends_at!) }
    : (() => {
        const end = date && time && endTime === "24:00" ? { date: addDays(date, 1), time: "00:00" } : date && time && endTime && endTime > time ? { date, time: endTime } : addMinutes(startDefault.date, startDefault.time, 60);
        return { sDate: startDefault.date, sTime: startDefault.time, eDate: end.date, eTime: end.time };
      })();
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState<CalKind>(event?.kind ?? "meeting");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [sDate, setSDate] = useState(init.sDate);
  const [sTime, setSTime] = useState(init.sTime);
  const [eDate, setEDate] = useState(init.eDate);
  const [eTime, setETime] = useState(init.eTime);
  const [location, setLocation] = useState(event?.location ?? "");
  const [memo, setMemo] = useState(event?.memo ?? "");
  // 회의 안건·자료(D-217): 회의 종류이거나 회의실을 잡을 때
  const [agenda, setAgenda] = useState(event?.agenda ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [room, setRoom] = useState<string>(event?.room_id ?? initialRoom ?? "");
  const [roomBookings, setRoomBookings] = useState<CalEvent[]>([]);
  const [attendees, setAttendees] = useState<string[]>(event ? event.attendees.map((a) => a.member_id).filter((x) => x !== me) : []);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 시작을 바꾸면 길이를 그대로 두고 끝도 같이 옮긴다
  const moveStart = (d: string, t: string) => {
    const len = (Date.parse(kstIso(eDate, eTime)) - Date.parse(kstIso(sDate, sTime))) / 60_000;
    setSDate(d);
    setSTime(t);
    const end = addMinutes(d, t, len > 0 ? len : 60);
    setEDate(end.date);
    setETime(end.time);
  };
  const moveStartDate = (d: string) => {
    if (allDay) {
      const len = Math.max(0, (Date.parse(eDate) - Date.parse(sDate)) / 86400_000);
      setSDate(d);
      const x = new Date(`${d}T00:00:00Z`);
      x.setUTCDate(x.getUTCDate() + len);
      setEDate(x.toISOString().slice(0, 10));
    } else moveStart(d, sTime);
  };

  // 9-14c ⑤: 시작을 고른 뒤 길이 한 번 누르기(끝 = 시작 + 길이). 다른 끝은 끝 칸에서
  const lenMin = (Date.parse(kstIso(eDate, eTime)) - Date.parse(kstIso(sDate, sTime))) / 60_000;
  const setLength = (min: number) => {
    const end = addMinutes(sDate, sTime, min);
    setEDate(end.date);
    setETime(end.time);
  };

  const startsIso = allDay ? kstIso(sDate, "00:00") : kstIso(sDate, sTime);
  const endsIso = allDay ? new Date(Date.parse(kstIso(eDate, "00:00")) + 86400_000).toISOString() : kstIso(eDate, eTime);

  // 참석자 고를 때: 그 시간에 이미 일정이 있는 사람 "일정 있음"
  useEffect(() => {
    if (!picking) return;
    const t = setTimeout(() => {
      void supabase.rpc("calendar_busy", { p_starts: startsIso, p_ends: endsIso, p_exclude: event?.id }).then(({ data }) => setBusyIds(new Set((data as string[] | null) ?? [])));
    }, 300);
    return () => clearTimeout(t);
  }, [picking, startsIso, endsIso, event?.id, supabase]);

  // 회의실: 고른 시간에 이미 잡힌 방은 "예약됨"(최종 판단은 DB — 동시에 눌러도 한 건만)
  useEffect(() => {
    if (!rooms.length || allDay || Date.parse(endsIso) <= Date.parse(startsIso)) return;
    const t = setTimeout(() => {
      void supabase.rpc("calendar_room_bookings", { p_starts: startsIso, p_ends: endsIso }).then(({ data }) => setRoomBookings((data as unknown as CalEvent[] | null) ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [rooms.length, allDay, startsIso, endsIso, supabase]);
  const taken = (id: string) => roomConflict(roomBookings, id, startsIso, endsIso, event?.id);
  const roomTaken = room && !allDay ? taken(room) : null;
  const meetingExtras = kind === "meeting" || (!!room && !allDay);

  const save = async () => {
    setErr(null);
    if (!title.trim()) return setErr("제목을 적어 주세요.");
    if (Date.parse(endsIso) <= Date.parse(startsIso)) return setErr("끝나는 시간이 시작보다 늦어야 해요.");
    setSaving(true);
    const p = {
      title: title.trim(),
      kind,
      all_day: allDay,
      ...(allDay ? { start_date: sDate, end_date: eDate } : { starts_at: startsIso, ends_at: endsIso }),
      location: location.trim() || null,
      memo: memo.trim() || null,
      agenda: meetingExtras ? agenda.trim() || null : (event?.agenda ?? null),
      room_id: !allDay && room ? room : null,
      attendee_ids: attendees,
    };
    const { data, error } = await supabase.rpc("calendar_save_event", { p_id: (event?.id ?? null) as unknown as string, p });
    if (error || !data) {
      setSaving(false);
      return setErr(saveErrorText(error?.message));
    }
    // 자료: 뺀 것 지우고, 고른 것 올리기(일정이 저장된 뒤라야 그 일정 폴더에 올릴 수 있다)
    for (const id of removedFiles) await deleteMeetingFile(supabase, id);
    if (meetingExtras && pendingFiles.length) {
      const problems = await uploadMeetingFiles(supabase, ws.split("/")[2], data as string, pendingFiles);
      if (problems.length) window.alert(`일정은 저장했어요. 다만 자료 일부를 올리지 못했어요.\n\n${problems.join("\n")}`);
    }
    setSaving(false);
    await onSaved(data as string, sDate);
  };

  const query = q.trim().toLowerCase();
  const deptName = new Map(directory.departments.map((d) => [d.id, d.name]));
  const candidates = directory.members.filter((m) => m.member_id !== me && (!query || m.name.toLowerCase().includes(query) || (deptName.get(m.department_id ?? "") ?? "").toLowerCase().includes(query)));
  const field = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-brand-500 md:text-sm";

  return (
    <Sheet title={event ? "일정 수정" : "새 일정"} onClose={onClose} wide>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">제목</span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))} placeholder="예) 주간 회의" className={field} autoFocus={!event} />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">종류</span>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="종류">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-11 rounded-xl border text-sm font-medium ${kind === k ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">날짜·시간</span>
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4" />
              종일
            </label>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <input type="date" aria-label="시작 날짜" value={sDate} onChange={(e) => e.target.value && moveStartDate(e.target.value)} className={field} />
            {!allDay && (
              <select aria-label="시작 시각" value={sTime} onChange={(e) => moveStart(sDate, e.target.value)} className={`${field} w-28`}>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <input type="date" aria-label="끝 날짜" value={eDate} min={sDate} onChange={(e) => e.target.value && setEDate(e.target.value)} className={field} />
            {!allDay && (
              <select aria-label="끝 시각" value={eTime} onChange={(e) => setETime(e.target.value)} className={`${field} w-28`}>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!allDay && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="일정 길이">
              <span className="text-xs text-zinc-500">길이</span>
              {[
                [30, "30분"],
                [60, "1시간"],
                [90, "1시간 30분"],
                [120, "2시간"],
              ].map(([min, label]) => (
                <button
                  key={min}
                  type="button"
                  aria-pressed={lenMin === min}
                  onClick={() => setLength(min as number)}
                  className={`min-h-9 rounded-full border px-3 text-[13px] ${lenMin === min ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
                  data-duration={min}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!allDay && <p className="text-xs text-zinc-500">시간은 10분 단위로 잡아요.{kind === "meeting" && " 회의는 시작 10분 전에 참석자에게 채팅 [알림]방으로 안내가 가요."}</p>}
          {event && !event.all_day === !allDay && <p className="text-xs text-zinc-500">시간을 바꾸면 참석자 응답은 다시 &lsquo;대기&rsquo;가 돼요.</p>}
        </div>

        {rooms.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="ev-room" className="text-sm font-semibold">
              회의실 <span className="font-normal text-zinc-500">(선택)</span>
            </label>
            {allDay ? (
              <p className="text-sm text-zinc-500">회의실은 시간 일정에만 잡을 수 있어요.</p>
            ) : (
              <>
                <select id="ev-room" value={room} onChange={(e) => setRoom(e.target.value)} className={field}>
                  <option value="">회의실 안 씀</option>
                  {rooms.map((r) => {
                    const c = taken(r.id);
                    return (
                      <option key={r.id} value={r.id} disabled={!!c && r.id !== room}>
                        {r.name}
                        {c ? ` — 예약됨 ${timeLabelOn(c, kstDateOf(c.starts_at!))}` : " — 비어 있음"}
                      </option>
                    );
                  })}
                </select>
                {roomTaken && (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    이 시간에 이미 예약됐어요: {timeLabelOn(roomTaken, kstDateOf(roomTaken.starts_at!))} {roomTaken.title}({roomTaken.creator_name}). 시간이나 회의실을 바꿔 주세요.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">
            장소 <span className="font-normal text-zinc-500">(선택)</span>
          </span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value.slice(0, 200))}
            placeholder={rooms.length > 0 ? "예) 거래처 사무실 · 회의실 밖 장소" : "예) 3층 회의실"}
            className={field}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            참석자 <span className="font-normal text-zinc-500">(나 포함 {attendees.length + 1}명)</span>
          </span>
          <ul className="flex flex-wrap gap-1.5">
            <li className="rounded-full bg-brand-100 px-2.5 py-1 text-sm font-medium text-brand-900">나</li>
            {attendees.map((id) => (
              <li key={id} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-2.5 pr-1 text-sm">
                {nameOf.get(id) ?? event?.attendees.find((a) => a.member_id === id)?.name ?? "?"}
                <button type="button" aria-label={`${nameOf.get(id) ?? ""} 빼기`} onClick={() => setAttendees((l) => l.filter((x) => x !== id))} className="inline-flex size-6 items-center justify-center rounded-full hover:bg-zinc-200">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-zinc-300 text-sm font-medium hover:bg-zinc-50">
            <Users className="size-4" />
            {picking ? "참석자 고르기 닫기" : "참석자 고르기"}
          </button>
          {picking && (
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-2">
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5">
                <Search className="size-4 text-zinc-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·부서 검색" aria-label="참석자 검색" className="min-h-10 min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" />
              </label>
              <ul className="flex max-h-60 flex-col overflow-y-auto">
                {candidates.map((m) => {
                  const on = attendees.includes(m.member_id);
                  return (
                    <li key={m.member_id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-zinc-50">
                        <input type="checkbox" checked={on} onChange={() => setAttendees((l) => (on ? l.filter((x) => x !== m.member_id) : [...l, m.member_id]))} className="size-4" />
                        <span className="min-w-0 flex-1 truncate">
                          {m.name}
                          <span className="ml-1 text-xs text-zinc-500">{[deptName.get(m.department_id ?? ""), m.position].filter(Boolean).join(" · ")}</span>
                        </span>
                        {busyIds.has(m.member_id) && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">일정 있음</span>}
                      </label>
                    </li>
                  );
                })}
                {!candidates.length && <li className="px-2 py-3 text-sm text-zinc-500">고를 수 있는 사람이 없어요.</li>}
              </ul>
            </div>
          )}
        </div>

        {meetingExtras && (
          <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3" aria-label="안건 및 자료">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                회의 안건 <span className="font-normal text-zinc-500">(선택)</span>
              </span>
              <textarea
                value={agenda}
                onChange={(e) => setAgenda(e.target.value.slice(0, 2000))}
                rows={3}
                aria-label="회의 안건"
                placeholder={"예) 1. 3분기 실적 점검\n2. 4분기 계획"}
                className={`${field} py-2`}
              />
              <span className="text-xs text-zinc-500">첫 줄은 회의 10분 전 알림에도 보여요.</span>
            </label>
            <MeetingFilesEdit
              existing={event?.files ?? []}
              removed={removedFiles}
              pending={pendingFiles}
              onRemoveExisting={(id) => setRemovedFiles((x) => [...x, id])}
              onAdd={(files, problems) => {
                setPendingFiles((x) => [...x, ...files]);
                setFileNote(problems.length ? problems.join(" ") : null);
              }}
              onRemovePending={(i) => setPendingFiles((x) => x.filter((_, k) => k !== i))}
            />
            {fileNote && (
              <p role="alert" className="text-sm text-amber-800">
                {fileNote}
              </p>
            )}
          </section>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">
            메모 <span className="font-normal text-zinc-500">(선택)</span>
          </span>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 2000))} rows={3} className={`${field} py-2`} />
        </label>

        {err && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-zinc-300 font-semibold text-zinc-700 hover:bg-zinc-50">
            취소
          </button>
          <button type="submit" disabled={saving || !!roomTaken} className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
            저장
          </button>
        </div>
      </form>
    </Sheet>
  );
}

