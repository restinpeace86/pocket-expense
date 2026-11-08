import Link from "next/link";
import { dayLabel } from "@/lib/attendance/month";
import { kstTime } from "@/lib/attendance/rules";
import { buildDay, type DayAdminData } from "@/lib/attendance/today";

// 관리자 홈 "오늘 출근" 카드(D-242): 근무 중 · 퇴근 · 출근 전 · 휴가 + 승인 대기 바로 가기
export function AttendanceHomeCard({ data, pending, href }: { data: DayAdminData; pending: number; href: string }) {
  const { summary } = buildDay(data);
  const cell = (label: string, n: number, color: string) => (
    <span className="flex min-w-0 flex-col rounded-xl border border-zinc-200 px-3 py-2">
      <span className="text-xs text-zinc-600">{label}</span>
      <b className={`text-lg ${color}`}>{n}명</b>
    </span>
  );
  return (
    <section aria-label="오늘 출근" className="flex flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 md:px-5" data-home-attendance>
      <div className="flex items-center gap-2">
        <b className="text-[15px]">오늘 출근</b>
        <span className="text-[13px] text-zinc-600">
          {dayLabel(data.date)} {kstTime(data.now)}
          {!data.workday && ` · ${data.holiday_name ?? "근무 요일 아님"}`}
        </span>
        <Link href={`${href}?tab=today`} className="ml-auto text-[13px] font-semibold text-brand-700 hover:underline">
          자세히 ›
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cell("근무 중", summary.working, "text-green-800")}
        {cell("퇴근", summary.out, "text-zinc-900")}
        {cell("출근 전", summary.before, "text-orange-800")}
        {cell("휴가", summary.leave, "text-teal-800")}
      </div>
      {pending > 0 && (
        <Link href={`${href}?tab=pending`} className="text-[13px] text-zinc-700 hover:underline">
          승인 대기 {pending}건 <b className="text-brand-700">승인하러 가기 ›</b>
        </Link>
      )}
    </section>
  );
}
