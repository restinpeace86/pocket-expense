import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { OwnCarEditor } from "@/components/employee/own-car-editor";
import { requireWorkspace } from "@/lib/auth/guards";
import { getMyClaimForEdit } from "@/lib/employee/claim";

export const metadata = { title: "영수증 항목 · PocketExpense" };

// 화면 E-02 항목 편집 (spec/screens/worker-tax-processing.md §3-3): 자차 유류비만 이 화면, 나머지는 결의서 화면의 펼침으로
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
  if (item.category === "trip" && item.trip_type === "own_car") {
    return (
      <OwnCarEditor
        key={`${item.id}:${item.distance_km}:${item.distance_source}`}
        claim={data.claim}
        item={item}
        index={index}
        total={data.items.length}
        prevId={data.items[index - 1]?.id ?? null}
        nextId={data.items[index + 1]?.id ?? null}
        fuel={data.fuel}
        base={base}
      />
    );
  }
  // 영수증은 결의서 화면 안에서 펼쳐 고친다(개선사항(2차) 3). 예전 주소·알림 링크로 들어오면 그 영수증을 펼친 결의서 화면으로
  redirect(`${base}/claims/${claimId}/edit?item=${item.id}`);
}
