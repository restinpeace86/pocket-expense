import "server-only";
import type { createClient } from "@/lib/supabase/server";

// 영수증 사진 링크를 화면당 한 번에 묶어서 발급한다 (performance.md §4). 권한은 저장소 정책(receipts_select)이 건다.
export const SIGNED_URL_TTL_SECONDS = 600;

export async function signReceiptUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await supabase.storage.from("receipts").createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return out; // 링크를 못 받으면 화면은 '사진을 불러오지 못했어요'로 대신한다
  for (const row of data) if (row.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
  return out;
}
