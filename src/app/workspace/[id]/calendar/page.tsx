import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/paths";
import { monthCells, todayKst } from "@/lib/calendar/calendar";
import { getCalendarDirectory, getCalendarEvents, getHolidayList, getMeetingRooms } from "@/lib/calendar/server";

// 사내 캘린더(D-206): PC = 월 달력, 휴대폰 = 그 달 날짜별 목록(같은 데이터, 폭으로만 바뀜)
// ?date=YYYY-MM-DD&event=… : 채팅 알림방의 [캘린더에서 보기]로 들어오면 그 달·그 일정을 연다
export default function CalendarPage({ params, searchParams }: PageProps<"/workspace/[id]/calendar">) {
  return (
    <Suspense fallback={<div className="m-4 h-96 flex-1 animate-pulse rounded-2xl bg-zinc-100" />}>
      <Calendar params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Calendar({ params, searchParams }: Pick<PageProps<"/workspace/[id]/calendar">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id);
  const today = todayKst();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const month = date ? date.slice(0, 7) : typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const eventId = typeof sp.event === "string" && /^[0-9a-f-]{36}$/.test(sp.event) ? sp.event : null;
  const [directory, holidays, rooms] = await Promise.all([getCalendarDirectory(), getHolidayList(), getMeetingRooms()]);
  if (!directory) {
    return <p className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">캘린더를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>;
  }
  // 기본은 나만(D-206). 고른 사람은 DB에 기억 — 퇴사 등으로 목록에 없는 사람은 뺀다
  const known = new Set(directory.members.map((m) => m.member_id));
  const saved = (directory.prefs?.member_ids ?? []).filter((x) => known.has(x));
  const selected = saved.length ? saved : [directory.me];
  const cells = monthCells(month);
  const events = await getCalendarEvents(cells[0].date, cells.at(-1)!.date, selected);
  return (
    <CalendarView
      ws={`/workspace/${id}`}
      admin={isAdminRole(membership.role)}
      today={today}
      initialMonth={month}
      initialDate={date}
      initialEventId={eventId}
      directory={directory}
      initialSelected={selected}
      initialShowDeadlines={directory.prefs?.show_deadlines ?? true}
      initialEvents={events}
      holidays={holidays}
      rooms={rooms}
    />
  );
}
