import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 크레딧을 쓴 영수증을 직원이 지울 때, 사진을 운영 보관함(receipt-archive)으로 옮겨 둔다 (D-080).
// 보관 사진은 삭제 후 ARCHIVE_RETENTION_MONTHS개월이 지나면 매일 도는 정리 작업이 지운다(/api/cron/purge-receipt-archive).
// 호출하는 쪽이 먼저 "본인 회사·본인 작성 중 결의서의 항목"인지 확인해야 한다.
export const ARCHIVE_RETENTION_MONTHS = 3;

function purgeAfter(now = new Date()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() + ARCHIVE_RETENTION_MONTHS);
  return d.toISOString();
}

const ext = (path: string) => path.slice(path.lastIndexOf("."));

// 실패하면 false — 그때는 지우지 않는다(소명 근거를 잃지 않게)
export async function archiveCreditedReceipts(companyId: string, itemIds: string[]): Promise<boolean> {
  if (itemIds.length === 0) return true;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data: records, error } = await admin
    .from("receipt_usage_records")
    .select("id, item_id, receipt_path, thumb_path, archived_receipt_path")
    .eq("company_id", companyId)
    .in("item_id", itemIds);
  if (error) return false;
  for (const r of records ?? []) {
    if (r.archived_receipt_path) continue; // 이미 옮김
    const moves: [string, string][] = [];
    if (r.receipt_path) moves.push([r.receipt_path, `${companyId}/${r.item_id}${ext(r.receipt_path)}`]);
    if (r.thumb_path) moves.push([r.thumb_path, `${companyId}/${r.item_id}_thumb${ext(r.thumb_path)}`]);
    const done: Record<string, string> = {};
    for (const [from, to] of moves) {
      const { error: copyError } = await admin.storage.from("receipts").copy(from, to, { destinationBucket: "receipt-archive" });
      if (copyError) {
        // 원본 파일이 없으면(업로드 도중 실패 등) 옮길 것이 없다. 그 밖의 실패는 지우지 않는다.
        const missing = /not.?found|does not exist/i.test(copyError.message);
        if (!missing) return false;
        continue;
      }
      done[from] = to;
    }
    const { error: updateError } = await admin
      .from("receipt_usage_records")
      .update({
        archived_receipt_path: r.receipt_path ? (done[r.receipt_path] ?? null) : null,
        archived_thumb_path: r.thumb_path ? (done[r.thumb_path] ?? null) : null,
        photo_purge_after: purgeAfter(),
      })
      .eq("id", r.id);
    if (updateError) return false;
  }
  return true;
}
