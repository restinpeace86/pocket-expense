import { redirect } from "next/navigation";

// 예전 정정 신청 주소(D-239) → D-257: [근태] 그 달을 열면서 그날 창의 신청 칸을 바로 띄운다
export default async function AttendanceRequestPage({ params, searchParams }: PageProps<"/workspace/[id]/employee/attendance/request">) {
  const { id } = await params;
  const sp = await searchParams;
  const base = `/workspace/${id}/employee/attendance`;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  if (!date) redirect(base);
  const kind = sp.kind === "holiday" ? "holiday" : "correction";
  redirect(`${base}?month=${date.slice(0, 7)}&date=${date}&kind=${kind}`);
}
