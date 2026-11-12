import { Suspense } from "react";
import { AttendanceGuide } from "@/components/admin/attendance-guide";
import { SectionHeading } from "@/components/ui/help";
import { AttendancePart } from "./part";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `근무 기준 · ${BRAND.name}` };

// 설정 › 근태 정책 › 근무 기준(D-236 → D-251). 켜기·끄기는 설정 › 기능 사용, 출근 단말·변경 이력은 옆 탭
export default function AttendanceSettingsPage({ params }: PageProps<"/workspace/[id]/admin/attendance-settings">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="근무 기준"
        summary="근무하는 요일·시각과 퇴근을 잊었을 때 알릴 시간을 정해요."
        helpId="admin.attendance-settings"
        helpLabel="근태는 이렇게 동작해요 (예시 화면)"
        help={<AttendanceGuide />}
      />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <AttendancePart params={params} part="rules" />
      </Suspense>
    </>
  );
}
