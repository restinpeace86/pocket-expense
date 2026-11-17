import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 서버에서 올리기 전에 회사 저장 공간이 꽉 찼는지(D-286). 확인이 안 되면 막지 않는다(저장소 규칙이 한 번 더 막음)
export async function storageFull(): Promise<boolean> {
  const { data } = await (await createClient()).rpc("storage_is_full");
  return data === true;
}
// 서버 키로 직접 올리는 곳(홈택스·지급 증빙·회계 양식) — 저장소 규칙을 거치지 않으므로 여기서 막는다
export async function storageFullFor(companyId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.rpc("storage_is_full_for", { p_company: companyId });
  return data === true;
}
