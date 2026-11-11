import { Suspense } from "react";
import { AttendanceSwitch } from "@/components/admin/attendance-admin";
import { CalendarSwitch } from "@/components/admin/calendar-switch";
import { SectionHeading } from "@/components/ui/help";
import { attendanceEnabled } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { calendarEnabled } from "@/lib/calendar/server";

export const metadata = { title: "기능 사용 · Moa-on" };

// 설정 › 기능 사용(D-251): 회사 전체에 켜고 끄는 기능 모음. 꺼도 기록은 지워지지 않는다
export default function FeaturesPage({ params }: PageProps<"/workspace/[id]/admin/features">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="기능 사용"
        summary="회사 전체에 켜고 끄는 기능이에요. 꺼도 지금까지의 기록은 지워지지 않아요."
        helpId="admin.features"
        help={
          <>
            <p>
              <b>근태</b>를 켜면 직원 하단 가운데 버튼이 [QR 출퇴근]으로 바뀌고, 설정에 [근태 정책] 메뉴가 생겨요.
            </p>
            <p>
              <b>사내 캘린더</b>는 처음부터 켜져 있어요. 회의·외근·출장 일정과 마감일을 함께 보고, 회의실을 예약해요. 쓰지 않는 회사는 꺼서 직원 화면에서 숨길 수 있어요.
            </p>
          </>
        }
      />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/features">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  const [attendance, calendar] = await Promise.all([attendanceEnabled(), calendarEnabled()]);
  return (
    <div className="flex flex-col gap-4">
      <AttendanceSwitch enabled={attendance} />
      <CalendarSwitch enabled={calendar} calendarHref={`/workspace/${id}/calendar`} />
    </div>
  );
}
