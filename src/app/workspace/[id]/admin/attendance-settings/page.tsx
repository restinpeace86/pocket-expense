import { Suspense } from "react";
import { AttendanceAdmin } from "@/components/admin/attendance-admin";
import { AttendanceGuide } from "@/components/admin/attendance-guide";
import { SectionHeading } from "@/components/ui/help";
import { getAttendanceAdminView } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "근태 · WORKON" };

// 근태 설정(D-236, spec/features/attendance.md §1·§2-1): 켜기·근무 기준·출근 단말·변경 이력
// 사용 안내는 평소 접혀 있고(처음 한 번만 펼쳐 보임) 예시 화면 그림으로 설명한다
export default function AttendanceSettingsPage({ params }: PageProps<"/workspace/[id]/admin/attendance-settings">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="근태"
        summary="회사 기기에 QR을 띄워 두고, 직원이 휴대폰으로 찍어 출근·퇴근을 남겨요."
        helpId="admin.attendance-settings"
        helpLabel="근태는 이렇게 동작해요 (예시 화면)"
        help={<AttendanceGuide />}
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/attendance-settings">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  const view = await getAttendanceAdminView();
  return <AttendanceAdmin view={view} />;
}
