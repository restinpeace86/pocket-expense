import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequestForm } from "@/components/attendance/request-form";
import { buildMonth, type MonthData } from "@/lib/attendance/month";
import { attendanceEnabled } from "@/lib/attendance/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "정정 신청 · WORKON" };

// 정정 신청 · 휴일 근무 상신 쓰기(spec/features/attendance.md §6, D-239). ?date=YYYY-MM-DD&kind=correction|holiday
export default function AttendanceRequestPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/attendance/request">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Request params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Request({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/attendance/request">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const base = `/workspace/${id}/employee`;
  if (!(await attendanceEnabled())) notFound();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const kind = sp.kind === "holiday" ? "holiday" : "correction";
  if (!date) notFound();
  const supabase = await createClient();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.rpc("my_attendance_month", { p_month: date.slice(0, 7) }),
    supabase.from("attendance_settings").select("work_start, work_end").maybeSingle(),
  ]);
  if (error || !data) throw new Error(error?.message ?? "my_attendance_month");
  const month = data as unknown as MonthData;
  const row = buildMonth(month).rows.find((r) => r.date === date) ?? null;
  const allowed = !!row && (kind === "holiday" ? row.canHoliday : row.canCorrect);
  return (
    <RequestForm
      back={`${base}/attendance?month=${date.slice(0, 7)}`}
      kind={kind}
      row={allowed ? row : null}
      today={month.today}
      defaults={{ in: settings?.work_start?.slice(0, 5) ?? "", out: settings?.work_end?.slice(0, 5) ?? "" }}
      dateLabel={row?.label ?? date}
    />
  );
}
