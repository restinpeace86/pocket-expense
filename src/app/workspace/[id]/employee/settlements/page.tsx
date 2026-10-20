import { Suspense } from "react";
import { SettlementsView } from "@/components/employee/settlements-view";
import { requireWorkspace } from "@/lib/auth/guards";
import { getMySettlements } from "@/lib/employee/settlements";

export const metadata = { title: "정산 내역 · PocketExpense" };

// 화면 E-03 정산 내역 (worker-timeline.md) — 알림톡 [나의 정산 타임라인 확인] 도착지
export default function SettlementsPage({ params }: PageProps<"/workspace/[id]/employee/settlements">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-64 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Settlements params={params} />
    </Suspense>
  );
}

async function Settlements({ params }: { params: PageProps<"/workspace/[id]/employee/settlements">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  const data = await getMySettlements(membership.company_id, membership.member_id);
  return <SettlementsView {...data} base={`/workspace/${id}/employee`} />;
}
