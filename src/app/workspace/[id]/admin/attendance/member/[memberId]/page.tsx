import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MonthView } from "@/components/attendance/month-view";
import { buildMonth, shiftMonth, type MonthData } from "@/lib/attendance/month";
import { attendanceEnabled } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { currentMonthKst } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "직원 월 근태 · WORKON" };

// 관리자: 직원 월 근태(D-242) — 직원 화면과 같은 목록, 보기만(신청·취소 버튼 없음)
export default function MemberMonthPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/attendance/member/[memberId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/attendance/member/[memberId]">, "params" | "searchParams">) {
  const { id, memberId } = await params;
  const sp = await searchParams;
  await requireWorkspace(id, { admin: true });
  if (!(await attendanceEnabled())) notFound();
  const current = currentMonthKst();
  const asked = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : current;
  const self = `/workspace/${id}/admin/attendance/member/${memberId}`;
  if (asked > current) redirect(self);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_member_month", { p_member: memberId, p_month: asked });
  if (error?.message.includes("NOT_FOUND")) notFound();
  if (error || !data) throw new Error(error?.message ?? "attendance_member_month");
  const d = data as unknown as MonthData & { member: { name: string; department: string | null } };
  const { rows, summary } = buildMonth({ ...d, request_from: undefined });
  return (
    <div className="-mx-4 -my-6 md:-mx-8">
      <MonthView
        base={`/workspace/${id}/admin`}
        month={asked}
        prev={shiftMonth(asked, -1)}
        next={asked < current ? shiftMonth(asked, 1) : null}
        rows={rows}
        summary={summary}
        monthEnd={null}
        flash={null}
        readOnly
        title={`${d.member.name}${d.member.department ? ` · ${d.member.department}` : ""}`}
        backHref={`/workspace/${id}/admin/attendance?tab=today`}
        backLabel="근태로"
        monthPrefix={`${self}?month=`}
      />
    </div>
  );
}
