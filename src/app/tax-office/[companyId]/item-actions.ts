"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 세무사무소: 영수증별 계정과목 조정 (D-156). 고객사를 볼 수 있는지·승인/지급·마감 여부는 DB 함수가 확인. null = 분류 기준으로 되돌리기
export async function officeOverrideItemAccountAction(itemId: string, accountTitleId: string | null): Promise<{ ok: true; name: string | null; overridden: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tax_office_override_item_account_title", { p_item_id: itemId, p_account_title_id: accountTitleId as string });
  if (error) return { ok: false, error: messageForDbError(error) };
  const j = data as { name: string | null; overridden: boolean };
  refresh();
  return { ok: true, name: j.name, overridden: !!j.overridden };
}
