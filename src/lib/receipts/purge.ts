import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 운영 보관함 정리 (D-080): 직원이 지운 영수증 사진은 삭제 후 3개월이 지나면 지운다. 기록(텍스트)은 남긴다.
// 새벽 작업(/api/cron/nightly)과 예전 경로(/api/cron/purge-receipt-archive)가 같이 쓴다.
export async function purgeReceiptArchive(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<{ ok: boolean; purged: number }> {
  let purged = 0;
  for (let round = 0; round < 10; round++) {
    const { data: due, error } = await admin
      .from("receipt_usage_records")
      .select("id, archived_receipt_path, archived_thumb_path")
      .is("photo_purged_at", null)
      .lt("photo_purge_after", new Date().toISOString())
      .limit(200);
    if (error) return { ok: false, purged };
    if (!due?.length) break;
    const paths = due.flatMap((r) => [r.archived_receipt_path, r.archived_thumb_path]).filter((p): p is string => !!p);
    if (paths.length) {
      const { error: removeError } = await admin.storage.from("receipt-archive").remove(paths);
      if (removeError) return { ok: false, purged };
    }
    const { error: updateError } = await admin
      .from("receipt_usage_records")
      .update({ photo_purged_at: new Date().toISOString() })
      .in("id", due.map((r) => r.id));
    if (updateError) return { ok: false, purged };
    purged += due.length;
  }
  return { ok: true, purged };
}
