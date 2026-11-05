"use server";

import { getMembership } from "@/lib/auth/session";
import { oneLine } from "@/lib/chat/format";
import { pushToMembers } from "@/lib/push/server";
import { createClient } from "@/lib/supabase/server";

type PushInfo = {
  room_id: string;
  company_id: string;
  kind: "direct" | "group" | "claim";
  room_title: string | null;
  sender_name: string;
  message_kind: "text" | "image" | "file";
  body: string | null;
  recipients: string[];
};

// 방금 보낸 메시지를 받는 사람들에게 웹푸시(D-203). 같은 메시지는 한 번만(DB가 pushed_at으로 막음).
// 메시지 저장은 화면이 Supabase로 바로 하고(빠르게), 알림만 여기서 뒤따라 보낸다
export async function pushChatMessageAction(messageId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_claim_push", { p_id: messageId });
  const info = data as unknown as PushInfo | null;
  if (!info || !info.recipients?.length) return;
  const text = info.message_kind === "image" ? "사진을 보냈어요." : info.message_kind === "file" ? "파일을 보냈어요." : (info.body ?? "");
  const title = info.kind === "direct" ? info.sender_name : info.kind === "claim" ? `📄 ${info.room_title ?? "소명서 대화"}` : (info.room_title ?? "그룹 채팅");
  // 알림 한 장 = 제목(1:1은 보낸 사람, 단체방은 방 이름) + 내용 한 줄(길면 …) — D-214
  const body = oneLine(info.kind === "direct" ? text : `${info.sender_name}: ${text}`);
  await pushToMembers(info.company_id, info.recipients, { title, body, url: `/workspace/${info.company_id}/chat/${info.room_id}`, tag: `chat-${info.room_id}`, urgency: "high" });
}

// 소명서 화면 [대화하기] → 그 소명서 방(없으면 만들고, 나와 작성자가 들어감)
export async function openClaimChatAction(claimId: string): Promise<{ roomId: string } | { error: string }> {
  const membership = await getMembership();
  if (!membership) return { error: "로그인이 필요해요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_open_claim", { p_claim: claimId });
  if (error || !data) return { error: error?.message === "FEATURE_DISABLED" ? "메신저를 쓸 수 없는 회사예요." : "대화방을 열지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  return { roomId: data };
}
