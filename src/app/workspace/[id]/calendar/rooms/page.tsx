import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/paths";
import { todayKst } from "@/lib/calendar/calendar";
import { getCalendarDirectory, getMeetingRooms } from "@/lib/calendar/server";

export const metadata = { title: "회의실 예약 · WORKON" };

// 회의실 예약 주소(D-215). D-234부터 예약은 캘린더 안 시트·창으로 연다 — 이 주소(도우미 답·예전 채팅 링크)는
// 회의실이 있으면 캘린더(?rooms=날짜&room=)로 넘기고, 회의실이 없을 때만 안내를 보여 준다
export default function RoomsPage({ params, searchParams }: PageProps<"/workspace/[id]/calendar/rooms">) {
  return (
    <Suspense fallback={<div className="m-4 h-96 flex-1 animate-pulse rounded-2xl bg-zinc-100" />}>
      <Rooms params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Rooms({ params, searchParams }: Pick<PageProps<"/workspace/[id]/calendar/rooms">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const membership = await requireWorkspace(id);
  const admin = isAdminRole(membership.role);
  const ws = `/workspace/${id}`;
  const today = todayKst();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const room = typeof sp.room === "string" && /^[0-9a-f-]{36}$/.test(sp.room) ? sp.room : null;
  const [directory, rooms] = await Promise.all([getCalendarDirectory(), getMeetingRooms()]);
  if (directory && rooms.length) redirect(`${ws}/calendar?rooms=${date}${room ? `&room=${room}` : ""}`);
  if (!directory) {
    return <p className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">회의실을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>;
  }
  if (!rooms.length) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 pb-32 pt-4">
        <h1 className="text-xl font-bold tracking-tight">회의실 예약</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">아직 등록된 회의실이 없어요.</p>
          <p className="mt-1">
            {admin ? "설정 › 캘린더·회의실에서 회의실을 추가하면 여기서 예약할 수 있어요." : "관리자가 회의실을 등록하면 여기서 예약할 수 있어요. 장소는 일정에 글자로 적어 주세요."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {admin && (
              <Link href={`${ws}/admin/calendar-settings`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
                회의실 등록하기
              </Link>
            )}
            <Link href={`${ws}/calendar`} className="inline-flex min-h-11 items-center rounded-xl border border-zinc-200 px-4 font-medium hover:bg-zinc-50">
              캘린더로
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return null;
}
