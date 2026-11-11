import { Suspense } from "react";
import { SectionHeading } from "@/components/ui/help";
import { AttendancePart } from "../part";

export const metadata = { title: "출근 단말 · Moa-on" };

// 설정 › 근태 정책 › 출근 단말(D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/attendance-settings/terminals">) {
  return (
    <>
      <SectionHeading as="h1" title="출근 단말" summary="회사 입구 PC·태블릿을 출근 단말로 연결해 QR을 띄워요." />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <AttendancePart params={params} part="terminals" />
      </Suspense>
    </>
  );
}
