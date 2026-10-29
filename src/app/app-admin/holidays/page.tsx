import { Suspense } from "react";
import { Panel } from "@/components/app-admin/app-admin-shell";
import { HolidayEditor } from "@/components/app-admin/holiday-editor";
import { requireAppAdmin } from "@/lib/app-admin/guard";

export const metadata = { title: "공휴일 · PocketExpense 운영자" };

// 공휴일 (D-161): 마감일·알림일이 이 날짜거나 주말이면 앞 영업일로 당긴다. 해마다 연말에 다음 해 공휴일(대체공휴일·선거일)을 확인해 넣는다
export default function HolidaysPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const from = `${new Date().getUTCFullYear() - 1}-01-01`;
  const { data } = await admin.from("kr_holidays").select("day, name").gte("day", from).order("day");
  const rows = data ?? [];
  const years = [...new Set(rows.map((r) => r.day.slice(0, 4)))];
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">공휴일</h1>
        <p className="mt-1 break-keep text-sm text-zinc-500">
          직원 청구 마감(매월 2일)·세무 마감(5일)과 관리자 알림일이 주말이나 아래 날짜면 앞 영업일로 당겨져요. 대체공휴일·선거일·임시공휴일이 정해지면 여기 넣어 주세요.
          {years.length > 0 && ` 등록된 해: ${years.join(", ")}.`}
        </p>
      </div>
      <Panel title={`공휴일 ${rows.length}일`}>
        <HolidayEditor rows={rows} />
      </Panel>
    </>
  );
}
