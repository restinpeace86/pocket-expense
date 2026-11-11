import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VacationTypesAdmin, VacationTypesGuide } from "@/components/admin/vacation-types-admin";
import { SectionHeading } from "@/components/ui/help";
import { attendanceEnabled, getLeaveTypesAdmin } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "휴가 종류 · Moa-on" };

// 휴가 종류(D-241, spec/features/attendance.md §8-1): 설정 > 근태 안. 근태 꺼진 회사는 404
export default function VacationTypesPage({ params }: PageProps<"/workspace/[id]/admin/attendance-settings/vacation-types">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="휴가 종류"
        summary="우리 회사에서 쓰는 휴가를 켜고 끄고, 연차가 모자랄 때 어떻게 할지 정해요."
        helpId="admin.vacation-types"
        helpLabel="휴가 종류는 이렇게 써요 (법 안내 · 예시 화면)"
        help={<VacationTypesGuide />}
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/attendance-settings/vacation-types">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  if (!(await attendanceEnabled())) notFound();
  const data = await getLeaveTypesAdmin();
  return <VacationTypesAdmin data={data} />;
}
