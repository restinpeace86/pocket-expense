"use server";

import type { ChatMessage, ChatThread } from "@/lib/chat/format";
import { geminiLine, lineText, summaryPrompt, titlePrompt } from "@/lib/chat/thread-ai";
import { THREAD_SUMMARY_MAX, THREAD_TITLE_MAX } from "@/lib/chat/threads";
import { createClient } from "@/lib/supabase/server";

// 서브 대화 제목 제안(D-246): 원래 메시지 + 앞 글 몇 개. 읽기 권한은 로그인한 사람 그대로(RLS·DB 함수) — 못 읽으면 빈 문자열
export async function suggestThreadTitleAction(roomId: string, rootId: string): Promise<string> {
  const supabase = await createClient();
  const { data: root } = await supabase.from("chat_messages").select("id, room_id, kind, body, attachment_name, created_at, sender_member_id, thread_id").eq("id", rootId).eq("room_id", roomId).maybeSingle();
  if (!root || root.thread_id) return "";
  const [{ data: before }, { data: names }] = await Promise.all([
    supabase.from("chat_messages").select("kind, body, attachment_name, sender_member_id").eq("room_id", roomId).is("thread_id", null).is("deleted_at", null).in("kind", ["text", "image", "file"]).lt("created_at", root.created_at).order("created_at", { ascending: false }).limit(4),
    supabase.rpc("chat_room_detail", { p_room: roomId }),
  ]);
  const who = new Map(((names as { members?: { member_id: string; name: string }[] } | null)?.members ?? []).map((m) => [m.member_id, m.name]));
  const line = (m: { kind: string; body: string | null; attachment_name: string | null; sender_member_id: string | null }) => lineText({ ...m, name: m.sender_member_id ? (who.get(m.sender_member_id) ?? null) : null });
  return geminiLine(titlePrompt(line(root), (before ?? []).reverse().map(line)), THREAD_TITLE_MAX);
}

// 종결 요약 제안(D-246): 서브 대화 최근 글 100개
export async function suggestThreadSummaryAction(threadId: string): Promise<string> {
  const supabase = await createClient();
  const [{ data: detail }, { data: msgs }] = await Promise.all([
    supabase.rpc("chat_thread_detail", { p_thread: threadId }),
    supabase.rpc("chat_thread_messages", { p_thread: threadId, p_limit: 100 }),
  ]);
  const d = detail as unknown as (ChatThread & { root: ChatMessage | null }) | null;
  if (!d) return "";
  const list = ((msgs as unknown as ChatMessage[]) ?? []).filter((m) => !m.deleted).reverse();
  if (!list.length) return "";
  const toLine = (m: ChatMessage) => lineText({ name: m.sender_name, kind: m.kind, body: m.body, attachment_name: m.attachment_name });
  return geminiLine(summaryPrompt(d.title, d.root ? toLine(d.root) : "", list.map(toLine)), THREAD_SUMMARY_MAX, 6000);
}
