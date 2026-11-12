import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeaveAdmin } from "@/components/admin/leave-admin";
import { LeaveLawGuide } from "@/components/admin/leave-law-guide";
import { SectionHeading } from "@/components/ui/help";
import { attendanceEnabled, getLeaveAdmin } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { todayKst } from "@/lib/dates";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `직원별 연차 · ${BRAND.name}` };

// 직원별 연차(D-240, spec/features/attendance.md §7): 설정 > 근태 안. 근태 꺼진 회사는 404
export default function LeavePage({ params, searchParams }: PageProps<"/workspace/[id]/admin/attendance-settings/leave">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="직원별 연차"
        summary="근로기준법 기준으로 직원마다 연차 일수를 계산해 보여 줘요. 회사가 확인하고 확정해요."
        helpId="admin.attendance-leave"
        helpLabel="연차는 법에서 이렇게 정해요 (근로기준법 제60조)"
        help={<LeaveLawGuide />}
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ params, searchParams }: Pick<PageProps<"/workspace/[id]/admin/attendance-settings/leave">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireWorkspace(id, { admin: true });
  if (!(await attendanceEnabled())) notFound();
  const current = Number(todayKst().slice(0, 4));
  const asked = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : current;
  const year = Math.min(Math.max(asked, current - 5), current + 1);
  const data = await getLeaveAdmin(year);
  return <LeaveAdmin data={data} base={`/workspace/${id}/admin`} />;
}
