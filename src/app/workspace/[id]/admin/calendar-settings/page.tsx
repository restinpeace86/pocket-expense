import Link from "next/link";
import { Suspense } from "react";
import { MeetingRoomsView } from "@/components/admin/meeting-rooms-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { calendarEnabled, getMeetingRooms } from "@/lib/calendar/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `회의실 · ${BRAND.name}` };

// 설정 › 회사 자산 › 회의실(D-207 → D-251). 캘린더 켜기·끄기는 설정 › 기능 사용
export default function CalendarSettingsPage({ params }: PageProps<"/workspace/[id]/admin/calendar-settings">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="회의실"
        summary="캘린더에서 예약할 회의실을 등록해요. 회의실이 없는 회사는 등록하지 않아도 돼요."
        helpId="admin.calendar-settings"
        help={
          <p>
            같은 회의실은 같은 시간에 한 건만 잡혀요. 직원은 캘린더의 [회의실 예약]에서 빈 시간을 보고 예약해요. 회의실이 없으면 일정의 장소를 글자로 적어요.
          </p>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/calendar-settings">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  const enabled = await calendarEnabled();
  const calendarHref = `/workspace/${id}/calendar`;
  if (!enabled)
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500" data-calendar-off>
        사내 캘린더가 꺼져 있어요.{" "}
        <Link href={`/workspace/${id}/admin/features`} className="font-semibold text-brand-700 hover:underline">
          설정 › 기능 사용
        </Link>
        에서 켜면 회의실을 등록할 수 있어요.
      </p>
    );
  return <MeetingRoomsView rooms={await getMeetingRooms()} calendarHref={calendarHref} />;
}
