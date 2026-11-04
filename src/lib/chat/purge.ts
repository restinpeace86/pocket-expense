import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 채팅 첨부 정리(D-204, 새벽 작업): ① 보관 기간(회사별 30·60·90일 company_chat_settings, 없으면 app_settings.chat_attachment_days = 90일, D-212)이 지난 사진·파일
// ② 삭제한 메시지에 남은 파일 ③ 올렸지만 메시지가 되지 않은 파일(하루 지난 것). 글·말풍선은 남기고 "보관 기간이 지난 파일"로 보인다
export async function purgeChatFiles(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<{ ok: boolean; purged: number; orphans: number }> {
  let purged = 0;
  let orphans = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await admin.rpc("chat_files_due", { p_limit: 200 });
    if (error) return { ok: false, purged, orphans };
    const rows = (data ?? []) as { message_id: string | null; paths: string[] | null }[];
    if (!rows.length) break;
    const paths = rows.flatMap((r) => r.paths ?? []);
    if (paths.length) {
      const { error: removeError } = await admin.storage.from("chat-files").remove(paths);
      if (removeError) return { ok: false, purged, orphans };
    }
    const ids = rows.map((r) => r.message_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { error: markError } = await admin.rpc("chat_files_mark_purged", { p_ids: ids });
      if (markError) return { ok: false, purged, orphans };
    }
    purged += ids.length;
    orphans += rows.length - ids.length;
  }
  return { ok: true, purged, orphans };
}
