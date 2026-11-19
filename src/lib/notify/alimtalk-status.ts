import "server-only";
import { createClient } from "@/lib/supabase/server";
import { KAKAO_CODES } from "./channel";
import { alimtalkReady } from "./sender";

// 설정 › 기능 사용 '결재 알림 받는 곳' 카드(D-297)
// included: 회사 요금제에 알림톡 포함(프로 이상) · enabled: 회사가 켬 · ready: 솔라피 키·심사 통과 템플릿 3종이 서버에 들어감(그 전엔 켤 수 없음)
export type AlimtalkStatus = { included: boolean; enabled: boolean; ready: boolean };

export async function getAlimtalkStatus(): Promise<AlimtalkStatus> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("alimtalk_status");
  const s = (data ?? {}) as { included?: boolean; enabled?: boolean };
  return { included: s.included === true, enabled: s.enabled === true, ready: alimtalkReady(KAKAO_CODES) };
}
