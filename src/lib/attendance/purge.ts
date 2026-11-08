import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 휴가 증빙 보관 기간(D-241): 휴가가 끝난 날 + 3년(근로기준법 제42조)이 지난 파일 → 저장소에서 지우고 purged_at(이름은 남음)
export async function purgeLeaveProofs(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<{ ok: boolean; purged: number }> {
  let purged = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await admin.rpc("leave_files_due", { p_limit: 200 });
    if (error) return { ok: false, purged };
    const rows = (data ?? []) as { id: string; path: string }[];
    if (!rows.length) break;
    const { error: removeError } = await admin.storage.from("leave-proofs").remove(rows.map((r) => r.path));
    if (removeError) return { ok: false, purged };
    const { error: markError } = await admin.rpc("leave_files_mark_purged", { p_ids: rows.map((r) => r.id) });
    if (markError) return { ok: false, purged };
    purged += rows.length;
  }
  return { ok: true, purged };
}
