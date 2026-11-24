"use server";

import { redirect } from "next/navigation";
import { messageForDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 계정 삭제(D-314, spec/features/account-deletion.md):
// ① DB가 본인 정리(막히는 경우 확인·개인정보 지움·로그인 연결 끊기, 회사 기록은 이름만 남김) → ② 로그인 계정(auth) 삭제 → ③ 이 기기 로그아웃.
// ①은 다시 불러도 같은 결과라 ②에서 실패해도 다시 누르면 끝난다.
export async function deleteMyAccountAction(): Promise<{ error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return { error: messageForDbError({ message: "NOT_AUTHENTICATED" }) };
  const admin = createAdminClient();
  if (!admin) return { error: "지금은 계정을 삭제할 수 없어요. 잠시 후 다시 시도해 주세요." };

  const { error } = await supabase.rpc("prepare_account_deletion");
  if (error) return { error: messageForDbError(error) };
  const { error: authError } = await admin.auth.admin.deleteUser(uid);
  if (authError) return { error: "계정을 끝까지 지우지 못했어요. 잠시 후 [계정 삭제]를 한 번 더 눌러 주세요." };
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/account/delete?done=1");
}
