import { AlarmClock, CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { addDays, deadlinesBetween, eventsOnDay, shortDayLabel, timeLabelOn, todayKst } from "@/lib/calendar/calendar";
import { getCalendarEvents, getHolidayList } from "@/lib/calendar/server";

// 직원 홈의 [캘린더] 카드(D-206): 오늘 내 일정 수·다음 일정 + 다음 청구 마감(굵게). 누르면 캘린더
export async function CalendarHomeCard({ ws, memberId }: { ws: string; memberId: string }) {
  const today = todayKst();
  const [events, holidays] = await Promise.all([getCalendarEvents(today, addDays(today, 6), [memberId]), getHolidayList()]);
  const todays = eventsOnDay(events, today).filter((e) => e.attendees.find((a) => a.member_id === memberId)?.response !== "declined");
  const now = Date.now();
  const next = todays.find((e) => !e.all_day && e.ends_at && Date.parse(e.ends_at) > now) ?? todays[0];
  const deadline = deadlinesBetween(today, addDays(today, 40), holidays.map((h) => h.day), false)[0];
  return (
    <Link href={`${ws}/calendar`} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50">
      <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <CalendarDays className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-base font-semibold">캘린더</span>
          <span className="text-sm text-zinc-600">오늘 일정 {todays.length}개</span>
        </span>
        {next && (
          <span className="mt-0.5 block truncate text-sm text-zinc-700">
            <span className="tabular-nums text-zinc-500">{timeLabelOn(next, today)}</span> {next.title}
          </span>
        )}
        {deadline && (
          <span className="mt-1 flex items-center gap-1 text-sm font-extrabold text-orange-700">
            <AlarmClock className="size-4 shrink-0" />
            {deadline.date === today ? "오늘" : shortDayLabel(deadline.date)} {deadline.label}
            <span className="font-semibold text-orange-600">· {deadline.sub}</span>
          </span>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0 text-zinc-400" />
    </Link>
  );
}
