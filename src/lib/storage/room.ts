// 회사 저장 공간이 꽉 찼을 때(D-286, migration 164): 영수증·증빙·첨부·채팅·보관함 등 모든 올리기가 막힌다
// 막힌 올리기는 '권한 없음'처럼 실패하므로, 실패했을 때 꽉 찼는지 한 번 물어 알맞은 안내로 바꾼다
import { createClient } from "@/lib/supabase/client";

import { STORAGE_FULL_MESSAGE } from "./room-message";
export { STORAGE_FULL_MESSAGE };

// 올리기 실패 뒤: 꽉 찼으면 그 안내, 아니면 원래 문구
export async function uploadFailText(fallback: string): Promise<string> {
  try {
    const { data } = await createClient().rpc("storage_is_full");
    return data === true ? STORAGE_FULL_MESSAGE : fallback;
  } catch {
    return fallback;
  }
}

// 올리기 전에 미리(여러 단계로 올리는 곳 — 예: 휴가 신청 + 증빙): 꽉 찼으면 안내 글, 아니면 null
export async function storageFullBefore(): Promise<string | null> {
  try {
    const { data } = await createClient().rpc("storage_is_full");
    return data === true ? STORAGE_FULL_MESSAGE : null;
  } catch {
    return null;
  }
}
