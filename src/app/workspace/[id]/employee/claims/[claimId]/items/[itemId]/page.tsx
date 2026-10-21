import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ItemEditor } from "@/components/employee/item-editor";
import { OwnCarEditor } from "@/components/employee/own-car-editor";
import { requireWorkspace } from "@/lib/auth/guards";
import { getMyClaimForEdit, signOriginalUrl } from "@/lib/employee/claim";

export const metadata = { title: "영수증 항목 · PocketExpense" };

// 화면 E-02 항목 편집 (spec/screens/worker-tax-processing.md §3-3)
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
  const originalUrl = await signOriginalUrl(item.receipt_path);
  return (
    <ItemEditor
      key={`${item.id}:${item.parse_status}`} // AI로 다시 읽은 뒤 새 값으로 다시 그린다
      claim={data.claim}
      item={item}
      index={index}
      total={data.items.length}
      prevId={data.items[index - 1]?.id ?? null}
      nextId={data.items[index + 1]?.id ?? null}
      cards={data.cards}
      mealPolicy={data.mealPolicy}
      mealOverride={data.mealOverride}
      originalUrl={originalUrl}
      base={base}
      deadline={data.deadline}
    />
  );
}
