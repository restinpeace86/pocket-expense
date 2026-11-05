"use server";

import { getMembership } from "@/lib/auth/session";
import { oneLine } from "@/lib/chat/format";
import { answer } from "@/lib/assistant/answer";
import { ASSISTANT_DAILY_LIMIT } from "@/lib/assistant/intent";
import { todayKst } from "@/lib/calendar/calendar";
import { pushToMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PushInfo = {
  room_id: string;
  company_id: string;
  kind: "direct" | "group" | "claim" | "assistant";
  room_title: string | null;
  sender_name: string;
  message_kind: "text" | "image" | "file";
  body: string | null;
  recipients: string[];
};

// 방금 보낸 메시지를 받는 사람들에게 웹푸시(D-203). 같은 메시지는 한 번만(DB가 pushed_at으로 막음).
// 메시지 저장은 화면이 Supabase로 바로 하고(빠르게), 알림만 여기서 뒤따라 보낸다
// 도우미 방(D-222)이면 웹푸시 대신 도우미 답을 만들어 넣고, 그 답 글을 돌려준다(화면이 바로 붙임). 같은 글에 답은 한 번(pushed_at)
export async function pushChatMessageAction(messageId: string): Promise<unknown | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_claim_push", { p_id: messageId });
  const info = data as unknown as PushInfo | null;
  if (info?.kind === "assistant") return answerInAssistantRoom(messageId, info);
  if (!info || !info.recipients?.length) return null;
  const text = info.message_kind === "image" ? "사진을 보냈어요." : info.message_kind === "file" ? "파일을 보냈어요." : (info.body ?? "");
  const title = info.kind === "direct" ? info.sender_name : info.kind === "claim" ? `📄 ${info.room_title ?? "소명서 대화"}` : (info.room_title ?? "그룹 채팅");
  // 알림 한 장 = 제목(1:1은 보낸 사람, 단체방은 방 이름) + 내용 한 줄(길면 …) — D-214
  const body = oneLine(info.kind === "direct" ? text : `${info.sender_name}: ${text}`);
  await pushToMembers(info.company_id, info.recipients, { title, body, url: `/workspace/${info.company_id}/chat/${info.room_id}`, tag: `chat-${info.room_id}`, urgency: "high" });
  return null;
}

async function answerInAssistantRoom(messageId: string, info: PushInfo): Promise<unknown | null> {
  const m = await getMembership();
  if (!m || m.status !== "approved" || m.company_id !== info.company_id) return null;
  const supabase = await createClient();
  // 내 도우미 방·내 글인지(읽기 권한 = 방 참여자, 도우미 방은 주인만)
  const [{ data: room }, { data: msg }] = await Promise.all([
    supabase.from("chat_rooms").select("id, kind, assistant_member_id").eq("id", info.room_id).maybeSingle(),
    supabase.from("chat_messages").select("id, body, sender_member_id").eq("id", messageId).maybeSingle(),
  ]);
  if (!room || room.kind !== "assistant" || room.assistant_member_id !== m.member_id || !msg || msg.sender_member_id !== m.member_id) return null;
  // 하루 30번(한국 시간 오늘, 이 방에 내가 보낸 글)
  const start = new Date(`${todayKst()}T00:00:00+09:00`).toISOString();
  const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("room_id", room.id).eq("sender_member_id", m.member_id).gte("created_at", start);
  const reply =
    (count ?? 0) > ASSISTANT_DAILY_LIMIT
      ? { body: `오늘은 도우미를 ${ASSISTANT_DAILY_LIMIT}번 다 썼어요. 내일 다시 물어봐 주세요. 그동안은 아래 메뉴에서 바로 찾을 수 있어요.`, link: null }
      : await answer(msg.body ?? "", m).catch(() => ({ body: "지금은 답을 찾지 못했어요. 잠시 뒤 다시 물어봐 주세요.", link: null }));
  // 답 글은 서버만 쓴다(도우미 방 'bot' 글 — 회원은 못 씀)
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: row } = await admin
    .from("chat_messages")
    .insert({ room_id: room.id, company_id: m.company_id, sender_member_id: null, kind: "bot", body: reply.body.slice(0, 4000), link: reply.link })
    .select("id, room_id, sender_member_id, kind, body, link, created_at")
    .single();
  if (!row) return null;
  await admin.from("chat_members").update({ last_read_at: row.created_at }).eq("room_id", room.id).eq("member_id", m.member_id);
  return { ...row, sender_name: null, attachment_path: null, attachment_thumb_path: null, attachment_name: null, attachment_size: null, attachment_mime: null, width: null, height: null, deleted: false };
}

// 채팅 목록 [WORKON 도우미] → 내 도우미 방(없으면 만들기)
export async function openAssistantRoomAction(): Promise<{ roomId: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_assistant_room");
  if (error || !data) return { error: error?.message?.includes("FEATURE_DISABLED") ? "메신저를 쓸 수 없는 회사예요." : "도우미 방을 열지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  return { roomId: data as string };
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
