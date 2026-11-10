// 서브 대화(D-246, spec/features/improvement-2026-11.md §A) — 화면 계산(순수 함수)
import type { ChatKind, ChatMessage, ChatThread } from "./format";

export const THREAD_KINDS: readonly ChatKind[] = ["direct", "group", "claim"]; // 알림방·도우미 방은 없음
export const THREAD_TITLE_MAX = 40;
export const THREAD_SUMMARY_MAX = 60;
export const OPEN_THREAD_EVENT = "workon:open-thread"; // 토스트·[내 서브 대화]에서 같은 방의 서브 대화 열기
export const THREAD_READ_EVENT = "workon:thread-read"; // 서브 대화를 읽음 → [내 서브 대화] 배지 다시 셈

// 이 메시지로 서브 대화를 만들 수 있나(보기는 thread가 있으면 언제나)
export function canStartThread(m: Pick<ChatMessage, "kind" | "deleted" | "pending" | "thread_id" | "thread">, roomKind: ChatKind | null | undefined): boolean {
  if (!roomKind || !THREAD_KINDS.includes(roomKind)) return false;
  if (m.thread || m.thread_id || m.deleted || m.pending) return false;
  return m.kind === "text" || m.kind === "image" || m.kind === "file";
}

// AI가 실패하면: 원래 글 첫 줄(사진·파일은 파일 이름)
export function fallbackTitle(m: Pick<ChatMessage, "kind" | "body" | "attachment_name">): string {
  const raw = m.kind === "text" ? (m.body ?? "").split(/\r?\n/).find((l) => l.trim()) ?? "" : (m.attachment_name ?? (m.kind === "image" ? "사진" : "파일"));
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length > THREAD_TITLE_MAX ? `${t.slice(0, THREAD_TITLE_MAX - 1)}…` : t;
}

// AI 답 다듬기: 따옴표·마침표·줄바꿈 제거, 길이 자르기
export function cleanAiLine(s: string | null | undefined, max: number): string {
  const t = (s ?? "").split(/\r?\n/)[0].replace(/^["'“”‘’「」\s]+|["'“”‘’「」\s.。]+$/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) : t;
}

// 카드 아래 줄: "3명 · 글 7개"
export function threadMeta(t: Pick<ChatThread, "people_count" | "message_count">): string {
  return `${t.people_count}명 · 글 ${t.message_count}개`;
}

// 실시간 글이 오면 카드 갱신: 새 글은 내가 참여자이고 남이 썼고 지금 그 서브 대화를 보고 있지 않을 때만 +1
export function applyThreadMessage(prev: ChatThread | null | undefined, next: ChatThread, o: { me: string; participants: string[]; senderId: string | null; insert: boolean; viewing: boolean }): ChatThread {
  const mine = o.participants.includes(o.me);
  const bump = o.insert && mine && o.senderId !== o.me && !o.viewing ? 1 : 0;
  return { ...next, mine, new: o.viewing ? 0 : (prev?.new ?? 0) + bump };
}

// 목록 거르기: 진행 중/종결 + 검색(제목·요약)
export function filterThreads<T extends Pick<ChatThread, "status" | "title" | "summary">>(list: T[], tab: "open" | "closed", q: string): T[] {
  const k = q.trim().toLowerCase();
  return list.filter((t) => t.status === tab && (!k || `${t.title} ${t.summary ?? ""}`.toLowerCase().includes(k)));
}
