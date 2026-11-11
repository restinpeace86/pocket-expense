import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VacationForm } from "@/components/attendance/vacation-form";
import { attendanceEnabled, getMyVacation } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { getLeaveInputs } from "@/lib/company-forms/leave-inputs";
import { todayKst } from "@/lib/dates";

export const metadata = { title: "휴가 신청 · Moa-on" };

// 휴가 신청(D-241, spec/features/attendance.md §8-3)
export default function VacationNewPage({ params }: PageProps<"/workspace/[id]/employee/vacation/new">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/vacation/new">, "params">) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  if (!(await attendanceEnabled())) notFound();
  const [data, custom] = await Promise.all([getMyVacation(Number(todayKst().slice(0, 4))), getLeaveInputs(membership.member_id)]);
  // 다음 해 연차 기간도 고를 수 있게 그 해 확정분까지 합친다
  const next = await getMyVacation(Number(todayKst().slice(0, 4)) + 1).catch(() => null);
  const grants = [...data.grants, ...(next?.grants ?? []).filter((g) => !data.grants.some((x) => x.period_start === g.period_start))];
  return <VacationForm data={{ ...data, grants }} back={`/workspace/${id}/employee/vacation`} companyId={id} memberId={membership.member_id} custom={custom} />;
}
