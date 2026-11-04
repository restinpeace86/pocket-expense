import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MeetingRoomsHeading, MeetingRoomsView } from "@/components/admin/meeting-rooms-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { calendarEnabled, getMeetingRooms } from "@/lib/calendar/server";

export const metadata = { title: "회의실 · PocketExpense" };

// 회의실 설정(D-207, spec/features/calendar.md §9): 캘린더 스위치가 켜진 회사의 관리자만
export default function MeetingRoomsPage({ params }: PageProps<"/workspace/[id]/admin/meeting-rooms">) {
  return (
    <>
      <MeetingRoomsHeading />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/meeting-rooms">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  if (!(await calendarEnabled())) notFound();
  const rooms = await getMeetingRooms();
  return <MeetingRoomsView rooms={rooms} calendarHref={`/workspace/${membership.company_id}/calendar`} />;
}
