// PC 무소음 시각 알림(D-246, spec/features/improvement-2026-11.md §B) — 언제 띄우나·토스트 쌓기(화면과 따로 시험)
import { noticeCard, oneLine, previewText, type ChatKind } from "./format";

export const TOAST_MS = 3000; // 3초 뒤 사라짐(마우스 올리면 멈춤)
export const TOAST_MAX = 3;
export const PULSE_GAP_MS = 1500; // 이 안에 또 오면 빛은 다시 켜지 않음
export const VISUAL_ALERT_EVENT = "workon:visual-alert"; // [내 정보]·채팅 설정에서 바꾸면 바로 반영

export type AlertMessage = {
  id: string;
  room_id: string;
  sender_member_id: string | null;
  sender_name: string | null;
  kind: string;
  body: string | null;
  deleted?: boolean;
  attachment_name?: string | null;
};

export type AlertToast = { key: string; roomId: string; sender: string | null; room: string; text: string; count: number; at: number };

// 띄울지: 켜짐 · PC 폭 · 화면이 보임 · 내가 보낸 게 아님 · 안내 줄 아님 · 그 방을 보고 있지 않음
export function shouldAlert(
  msg: Pick<AlertMessage, "room_id" | "sender_member_id" | "kind" | "deleted">,
  o: { meId: string; ws: string; pathname: string; enabled: boolean; wide: boolean; visible: boolean },
): boolean {
  if (!o.enabled || !o.wide || !o.visible) return false;
  if (msg.kind === "system" || msg.deleted) return false;
  if (msg.sender_member_id && msg.sender_member_id === o.meId) return false;
  if (o.pathname === `${o.ws}/chat/${msg.room_id}`) return false;
  return true;
}

// 토스트 한 줄 내용: 알림방 카드는 제목, 사진·파일은 웹푸시와 같은 말, 글은 한 줄
export function alertText(msg: AlertMessage, roomKind: ChatKind | null): string {
  if (roomKind === "notice") return oneLine(noticeCard(msg.body).title || msg.body || "새 알림", 60);
  if (!msg.deleted && msg.kind === "image") return "사진을 보냈어요.";
  if (!msg.deleted && msg.kind === "file") return "파일을 보냈어요.";
  return oneLine(previewText({ kind: msg.kind as never, body: msg.body, deleted: !!msg.deleted, attachment_name: msg.attachment_name ?? null }), 60);
}

// 같은 방은 한 장으로 합치고(+n, 맨 위로), 최대 3장(오래된 것부터 뺌)
export function pushToast(list: AlertToast[], t: Omit<AlertToast, "count" | "key">): AlertToast[] {
  const same = list.find((x) => x.roomId === t.roomId);
  const next: AlertToast = same ? { ...same, ...t, count: same.count + 1 } : { ...t, count: 1, key: t.roomId };
  const rest = list.filter((x) => x.roomId !== t.roomId);
  return [...rest, next].slice(-TOAST_MAX);
}
