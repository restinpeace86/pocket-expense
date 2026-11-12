import { Suspense } from "react";
import { SectionHeading } from "@/components/ui/help";
import { AttendancePart } from "../part";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `변경 이력 · ${BRAND.name}` };

// 설정 › 근태 정책 › 변경 이력(D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/attendance-settings/history">) {
  return (
    <>
      <SectionHeading as="h1" title="변경 이력" summary="근태 설정을 누가 언제 바꿨는지 남아요." />
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <AttendancePart params={params} part="history" />
      </Suspense>
    </>
  );
}
