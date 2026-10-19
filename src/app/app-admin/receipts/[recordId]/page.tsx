import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptRecordView } from "@/components/app-admin/receipt-record-view";
import { getReceiptRecord } from "@/lib/app-admin/queries";

export default function AppAdminReceipt({ params }: PageProps<"/app-admin/receipts/[recordId]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Receipt params={params} />
    </Suspense>
  );
}

async function Receipt({ params }: Pick<PageProps<"/app-admin/receipts/[recordId]">, "params">) {
  const { recordId } = await params;
  const data = await getReceiptRecord(recordId);
  if (!data) notFound();
  return <ReceiptRecordView data={data} />;
}
