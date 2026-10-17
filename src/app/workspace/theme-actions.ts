"use server";

import { isThemeKey } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

// 화면 색상을 계정에 저장 (D-066, migration 018). 본인 행만 바뀐다(RLS members_update_self + 컬럼 권한).
export async function saveUiThemeAction(key: string): Promise<{ error: string | null }> {
  if (!isThemeKey(key)) return { error: "INVALID_THEME" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { error: "NOT_AUTHENTICATED" };
  const { error } = await supabase.from("members").update({ ui_theme: key }).eq("auth_user_id", uid);
  return { error: error ? "SAVE_FAILED" : null };
}
