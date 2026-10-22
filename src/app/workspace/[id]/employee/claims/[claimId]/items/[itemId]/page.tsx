import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/auth/guards";
import { getMyClaimForEdit } from "@/lib/employee/claim";

export const metadata = { title: "영수증 항목 · PocketExpense" };

// 화면 E-02 항목 편집 (spec/screens/worker-tax-processing.md §3-3): 결의서 화면의 펼침으로 옮김(주소만 남김)
export default function ItemEditPage({ params }: PageProps<"/workspace/[id]/employee/claims/[claimId]/items/[itemId]">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <ItemEdit params={params} />
    </Suspense>
  );
}

async function ItemEdit({ params }: Pick<PageProps<"/workspace/[id]/employee/claims/[claimId]/items/[itemId]">, "params">) {
  const { id, claimId, itemId } = await params;
  const membership = await requireWorkspace(id);
  const data = await getMyClaimForEdit(membership, claimId);
  if (!data) notFound();
  const base = `/workspace/${id}/employee`;
  if (data.claim.status !== "draft" && data.claim.status !== "rejected") redirect(base);
  const index = data.items.findIndex((i) => i.id === itemId);
  if (index < 0) notFound();
  const item = data.items[index];
  // 영수증은 결의서 화면 안에서 펼쳐 고친다(개선사항(2차) 3·4, 자차 유류비 포함). 예전 주소·알림 링크로 들어오면 그 영수증을 펼친 결의서 화면으로
  return redirect(`${base}/claims/${claimId}/edit?item=${item.id}`);
}
