import { redirect } from "next/navigation";
import { Suspense } from "react";

// 옛 '회사 위치' 탭 주소(D-243 → D-251) — 2026-11-21 회사정보 탭으로 합침. 예전 링크·도움말은 회사정보의 위치 카드로
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/location">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Go params={params} />
    </Suspense>
  );
}

async function Go({ params }: { params: PageProps<"/workspace/[id]/admin/settings/location">["params"] }) {
  const { id } = await params;
  redirect(`/workspace/${id}/admin/settings#location`);
  return null;
}
