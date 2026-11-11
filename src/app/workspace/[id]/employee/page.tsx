import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getRecentNotices } from "@/lib/push/notices";
import { getMyAttendanceToday, myHireDateMissing } from "@/lib/attendance/server";
import { getCompanyNearby } from "@/lib/bus/server";
import { chatEnabled } from "@/lib/chat/server";
import { HireDatePrompt } from "@/components/attendance/hire-date-prompt";
import { NoticeStrip } from "@/components/push/notice-strip";
import { EmployeeHub, hubTiles, type HubEvent } from "@/components/employee/employee-hub";
import { requireWorkspace } from "@/lib/auth/guards";
import { eventsOnDay, placeLabel, timeLabelOn } from "@/lib/calendar/calendar";
import { calendarEnabled, getCalendarEvents, getMeetingRooms } from "@/lib/calendar/server";
import { getInboxBadge } from "@/lib/claims/inbox";
import { todayKst } from "@/lib/dates";
import { getMySummary } from "@/lib/employee/queries";

export const metadata = { title: "홈 · Moa-on" };

// 화면 E-01 직원 홈 = 허브 (spec/screens/worker-dashboard.md §0, D-235)
export default function EmployeeHomePage({ params, searchParams }: PageProps<"/workspace/[id]/employee">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-64 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <EmployeeHome params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeeHome({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const ws = `/workspace/${id}`;
  // 예전 홈 주소(?month= / ?status=)로 온 링크(도우미·알림)는 [지출결의] 화면으로 같은 조건을 넘긴다
  const keep = new URLSearchParams();
  for (const k of ["month", "status"] as const) if (typeof sp[k] === "string") keep.set(k, sp[k] as string);
  if (keep.size) redirect(`${ws}/employee/claims?${keep}`);

  const membership = await requireWorkspace(id);
  const today = todayKst();
  const [summary, notices, inbox, calendar, attendance, hireMissing, nearby, chat] = await Promise.all([getMySummary(), getRecentNotices(), getInboxBadge(membership), calendarEnabled(), getMyAttendanceToday(), myHireDateMissing(), getCompanyNearby(), chatEnabled()]);
  const [rooms, events] = calendar ? await Promise.all([getMeetingRooms(), getCalendarEvents(today, today, [membership.member_id])]) : [[], []];
  const todays: HubEvent[] | null = calendar
    ? eventsOnDay(events, today)
        .slice(0, 3)
        .map((e) => ({ id: e.id, time: timeLabelOn(e, today), title: e.title, place: placeLabel(e), href: `${ws}/calendar?date=${today}&event=${e.id}` }))
    : null;
  return (
    <EmployeeHub
      ws={ws}
      today={today}
      tiles={hubTiles(ws, { inbox, rooms: rooms.length > 0, today, attendance: attendance !== null, bus: !!nearby?.seoul, vault: chat })}
      events={todays}
      pendingPayout={summary.pending_payout}
      rejectedCount={summary.rejected_count}
      notices={
        hireMissing || notices.length ? (
          <div className="flex flex-col gap-3">
            {hireMissing && <HireDatePrompt />}
            {notices.length > 0 && <NoticeStrip notices={notices} />}
          </div>
        ) : null
      }
      attendance={attendance}
    />
  );
}
