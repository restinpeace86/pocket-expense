import { CalendarClock } from "lucide-react";
import { mdLabel, monthLabel } from "@/lib/expense/deadline";

export type ClosingDates = { month: string; claimCutoff: string; taxDue: string };
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const withDay = (d: string) => `${mdLabel(d)}(${WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;

// 마감 일정 (D-161, 개선사항 1): 회사별로 바꾸지 않는 고정 규칙 — 설정이 아니라 확인용.
// 알림을 받을지는 위 [이 기기에서 알림 받기]로 정한다
export function FixedClosingSection({ dates }: { dates: ClosingDates }) {
  const m = monthLabel(dates.month);
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="마감 일정">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        <CalendarClock className="size-5 text-zinc-500" aria-hidden />
        마감 일정
      </h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">모든 회사가 같은 일정이에요. 세무 일정이 어긋나지 않게 회사별로 바꾸지 않아요.</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <dt className="text-sm font-medium text-zinc-900">직원 청구 마감 · 매월 2일</dt>
          <dd className="mt-0.5 break-keep text-sm text-zinc-600">
            지난달 영수증은 2일까지 상신해요. 이번 {m} 사용분은 <b className="text-zinc-900">{withDay(dates.claimCutoff)}</b>까지.
          </dd>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <dt className="text-sm font-medium text-zinc-900">세무 마감 · 매월 5일</dt>
          <dd className="mt-0.5 break-keep text-sm text-zinc-600">
            관리자가 홈택스 자료를 올리고 지난달을 마감해 세무사무소에 넘겨요. {m}분은 <b className="text-zinc-900">{withDay(dates.taxDue)}</b>까지.
          </dd>
        </div>
      </dl>
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-600">
        <li className="break-keep">마감일이 주말·공휴일이면 앞 영업일로 당겨져요(위 날짜는 이미 당긴 날짜예요).</li>
        <li className="break-keep">청구 마감이 지나서 올린 지난달 영수증도 상신은 돼요. 대신 다음 달 정산(다음 세무 마감)으로 넘어가요.</li>
        <li className="break-keep">관리자에게 1일(마감 주간 시작)·3일(홈택스 자료를 아직 안 올렸을 때)·5일(아직 마감 안 했을 때) 알림이 가고, 직원에게는 청구 마감 3일 전·당일 알림이 가요.</li>
      </ul>
    </section>
  );
}
