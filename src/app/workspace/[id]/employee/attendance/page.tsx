import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MonthView } from "@/components/attendance/month-view";
import { buildMonth, monthEndNotice, shiftMonth, type MonthData } from "@/lib/attendance/month";
import { attendanceEnabled } from "@/lib/attendance/server";
import { currentMonthKst, todayKst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `출퇴근 기록 · ${BRAND.name}` };

// 월 근태 현황(spec/features/attendance.md §5 D-237, §6 D-239): 홈 메뉴 칸 [근태] → 이번 달. 근태 꺼진 회사는 404
// D-257: ?date=…(&kind=correction|holiday)면 그날 창(신청 칸)이 열린 채로
export default function AttendanceMonthPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/attendance">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Month params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Month({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/attendance">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const base = `/workspace/${id}/employee`;
  if (!(await attendanceEnabled())) notFound();
  const current = currentMonthKst();
  const asked = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : current;
  if (asked > current) redirect(`${base}/attendance`);
  const supabase = await createClient();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.rpc("my_attendance_month", { p_month: asked }),
    supabase.from("attendance_settings").select("work_start, work_end").maybeSingle(),
  ]);
  if (error || !data) throw new Error(error?.message ?? "my_attendance_month");
  const month = data as unknown as MonthData;
  const { rows, summary } = buildMonth(month);
  const flash = typeof sp.done === "string" ? sp.done : null;
  return (
    <MonthView
      base={base}
      month={asked}
      prev={shiftMonth(asked, -1)}
      next={asked < current ? shiftMonth(asked, 1) : null}
      rows={rows}
      summary={summary}
      monthEnd={asked === current ? monthEndNotice(todayKst()) : null}
      flash={flash}
      request={{ today: month.today, defaults: { in: settings?.work_start?.slice(0, 5) ?? "", out: settings?.work_end?.slice(0, 5) ?? "" } }}
    />
  );
}
