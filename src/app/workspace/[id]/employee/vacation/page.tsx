import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VacationView } from "@/components/attendance/vacation-view";
import { attendanceEnabled, getMyVacation } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { todayKst } from "@/lib/dates";

export const metadata = { title: "휴가 및 근태 신청 · Moa-on" };

// 직원 [휴가](D-241, spec/features/attendance.md §8-2). 근태 꺼진 회사는 404
export default function VacationPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/vacation">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/employee/vacation">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id);
  if (!(await attendanceEnabled())) notFound();
  const current = Number(todayKst().slice(0, 4));
  const asked = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : current;
  const year = Math.min(Math.max(asked, current - 5), current + 1);
  const data = await getMyVacation(year);
  return <VacationView data={data} base={`/workspace/${id}/employee`} companyId={id} memberId={membership.member_id} flash={typeof sp.done === "string" ? sp.done : null} />;
}
