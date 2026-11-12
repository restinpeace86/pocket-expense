import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QrCamera } from "@/components/attendance/qr-camera";
import { attendanceEnabled } from "@/lib/attendance/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `QR 출퇴근 · ${BRAND.name}` };

// 앱 안 QR 스캐너(spec/features/attendance.md §3-1, D-236). 근태가 꺼진 회사는 404
export default function AttendCameraPage({ params }: PageProps<"/workspace/[id]/employee/attend">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-40 bg-zinc-900" />}>
      <Camera params={params} />
    </Suspense>
  );
}

async function Camera({ params }: Pick<PageProps<"/workspace/[id]/employee/attend">, "params">) {
  const { id } = await params;
  if (!(await attendanceEnabled())) notFound();
  return <QrCamera home={`/workspace/${id}/employee`} />;
}
