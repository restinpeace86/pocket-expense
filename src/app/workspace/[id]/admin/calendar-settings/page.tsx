import { Suspense } from "react";
import { CalendarSwitch } from "@/components/admin/calendar-switch";
import { MeetingRoomsView } from "@/components/admin/meeting-rooms-view";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { calendarEnabled, getMeetingRooms } from "@/lib/calendar/server";

export const metadata = { title: "캘린더·회의실 · PocketExpense" };

// 캘린더·회의실 설정(D-207·D-208, spec/features/calendar.md §9·§10): 관리자가 캘린더를 켜고 끄고, 켜져 있으면 회의실을 등록
export default function CalendarSettingsPage({ params }: PageProps<"/workspace/[id]/admin/calendar-settings">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="캘린더·회의실"
        summary="사내 캘린더를 켜고 끄고, 예약할 회의실을 등록해요."
        helpId="admin.calendar-settings"
        help={
          <>
            <p>
              <b>캘린더를 켜면</b> 관리자 왼쪽 메뉴에 [캘린더], 직원 하단 메뉴에 [캘린더] 탭이 생겨요. 회의·외근·출장 일정을 같은 회사 사람끼리 함께 보고, 청구·세무 마감일도
              달력에 표시돼요. 회의는 시작 10분 전에 참석자의 채팅 [알림]방으로 안내가 가요.
            </p>
            <p>
              <b>끄면</b> 메뉴와 화면만 숨고 일정·회의실은 지워지지 않아요. 다시 켜면 그대로 보여요(끈 동안에는 회의 안내가 가지 않아요).
            </p>
            <p>
              <b>회의실</b>은 캘린더에서 예약할 수 있는 방이에요. 같은 회의실은 같은 시간에 한 건만 잡혀요. 회의실이 없는 회사는 등록하지 않아도 돼요(장소는 글자로
              적어요).
            </p>
          </>
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
  const membership = await requireWorkspace(id, { admin: true });
  const enabled = await calendarEnabled();
  const rooms = enabled ? await getMeetingRooms() : [];
  const calendarHref = `/workspace/${membership.company_id}/calendar`;
  return (
    <div className="flex flex-col gap-6">
      <CalendarSwitch enabled={enabled} calendarHref={calendarHref} />
      <section className="flex flex-col gap-3" aria-label="회의실">
        <h2 className="text-lg font-bold">회의실</h2>
        {enabled ? (
          <MeetingRoomsView rooms={rooms} calendarHref={calendarHref} />
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">캘린더를 켜면 회의실을 등록할 수 있어요.</p>
        )}
      </section>
    </div>
  );
}
