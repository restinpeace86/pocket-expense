import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VacationView } from "@/components/attendance/vacation-view";
import { attendanceEnabled, getMyVacation } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { getLeaveInputs } from "@/lib/company-forms/leave-inputs";
import { todayKst } from "@/lib/dates";

export const metadata = { title: "휴가 및 근태 신청 · Moa-on" };

// 직원 [휴가](D-241, spec/features/attendance.md §8-2). 근태 꺼진 회사는 404
// D-257: [휴가 신청]은 이 화면 위 창(?new=1) — 창에 쓸 회사 추가 항목·다음 해 연차 기간도 함께 읽는다
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
  const [data, thisYear, next, custom] = await Promise.all([
    getMyVacation(year),
    year === current ? null : getMyVacation(current),
    getMyVacation(current + 1).catch(() => null),
    getLeaveInputs(membership.member_id),
  ]);
  // 신청 창은 올해 기준 + 다음 해 연차 기간도 고를 수 있게(예전 /vacation/new와 같음)
  const formData = thisYear ?? data;
  const grants = [...formData.grants, ...(next?.grants ?? []).filter((g) => !formData.grants.some((x) => x.period_start === g.period_start))];
  return (
    <VacationView
      data={data}
      formData={{ ...formData, grants }}
      custom={custom}
      base={`/workspace/${id}/employee`}
      companyId={id}
      memberId={membership.member_id}
      flash={typeof sp.done === "string" ? sp.done : null}
    />
  );
}
