// 사내 메신저 화면 계산 (D-203, spec/features/messenger.md). 순수 함수라 단위 테스트한다.

export type ChatKind = "direct" | "group" | "claim" | "notice" | "assistant"; // notice = 사람마다 하나인 알림방(D-206), assistant = WORKON 도우미 방(D-222)
export type ChatMember = { member_id: string; name: string; status: string; last_read_at: string; joined_at: string };
export type ChatMessage = {
  id: string;
  room_id: string;
  sender_member_id: string | null;
  sender_name: string | null;
  kind: "text" | "image" | "file" | "system" | "notice" | "bot"; // bot = 도우미 답(D-222)
  body: string | null;
  link?: string | null; // 알림 글의 [캘린더에서 보기] 주소(D-206)
  attachment_path: string | null;
  attachment_thumb_path?: string | null; // 사진 말풍선용 미리보기(D-204). 예전 사진은 없음 → 원본
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  deleted: boolean;
  expired?: boolean; // 보관 기간(회사별 30·60·90일, D-212)이 지나 첨부 파일이 지워짐(D-204)
  // 화면 전용: 보내는 중·실패(낙관적 표시), 올리기 전 미리보기
  pending?: "sending" | "failed";
  localUrl?: string;
};
export type ChatRoomSummary = {
  id: string;
  kind: ChatKind;
  title: string | null;
  claim_id: string | null;
  claim_title: string | null;
  sort_at: string;
  last: ChatMessage | null;
  unread: number;
  members: ChatMember[];
};

const KST = 9 * 3600_000;
const kst = (iso: string) => new Date(Date.parse(iso) + KST);
const dayKey = (iso: string) => kst(iso).toISOString().slice(0, 10);

// 퇴사(비활성)한 멤버는 이름 뒤에 표시
export function displayName(m: Pick<ChatMember, "name" | "status"> | undefined | null, fallback = "알 수 없음"): string {
  if (!m) return fallback;
  return m.status === "inactive" ? `${m.name}(퇴사)` : m.name;
}

// 방 이름: 1:1 = 상대 이름 / 그룹 = 정한 이름 또는 참여자 이름 / 소명서 = 소명서 제목
export function roomTitle(room: { kind: ChatKind; title: string | null; claim_title?: string | null; members: Pick<ChatMember, "member_id" | "name" | "status">[] }, meId: string): string {
  const others = room.members.filter((m) => m.member_id !== meId);
  if (room.kind === "direct") return others[0] ? displayName(others[0]) : "대화 상대 없음";
  if (room.kind === "notice") return "알림";
  if (room.kind === "assistant") return "WORKON 도우미";
  if (room.kind === "claim") return room.claim_title?.trim() ? `📄 ${room.claim_title}` : "📄 소명서 대화";
  if (room.title?.trim()) return room.title;
  if (!others.length) return "대화 상대 없음";
  const names = others.map((m) => displayName(m));
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}명` : names.join(", ");
}

// 말풍선 옆 숫자: 보낸 사람을 빼고 아직 이 메시지까지 읽지 않은 참여자 수
export function unreadCountFor(msg: Pick<ChatMessage, "sender_member_id" | "created_at" | "kind">, members: Pick<ChatMember, "member_id" | "last_read_at">[]): number {
  if (msg.kind === "system" || msg.kind === "notice" || msg.kind === "bot") return 0;
  const at = Date.parse(msg.created_at);
  return members.filter((m) => m.member_id !== msg.sender_member_id && Date.parse(m.last_read_at) < at).length;
}

// "오후 3:05"
export function timeLabel(iso: string): string {
  const d = kst(iso);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

// 날짜 구분선 "2026년 11월 3일 화요일"
export function dateLabel(iso: string): string {
  const d = kst(iso);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${w}요일`;
}

// 목록의 시각: 오늘 = 시각, 어제 = "어제", 올해 = "11월 2일", 그 전 = "2025. 11. 2."
export function listTimeLabel(iso: string, nowIso: string = new Date().toISOString()): string {
  const today = dayKey(nowIso);
  const key = dayKey(iso);
  if (key === today) return timeLabel(iso);
  const yesterday = dayKey(new Date(Date.parse(nowIso) - 86400_000).toISOString());
  if (key === yesterday) return "어제";
  const d = kst(iso);
  if (key.slice(0, 4) === today.slice(0, 4)) return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}

// 목록·알림의 한 줄 미리보기
export function previewText(msg: Pick<ChatMessage, "kind" | "body" | "deleted" | "attachment_name"> | null): string {
  if (!msg) return "";
  if (msg.deleted) return "삭제된 메시지입니다.";
  if (msg.kind === "image") return "사진";
  if (msg.kind === "file") return `파일: ${msg.attachment_name ?? ""}`.trim();
  return (msg.body ?? "").replace(/\s+/g, " ").trim();
}

export type ChatRow =
  | { type: "date"; key: string; label: string }
  | { type: "system"; key: string; msg: ChatMessage }
  | { type: "notice"; key: string; msg: ChatMessage }
  | { type: "bot"; key: string; msg: ChatMessage }
  | { type: "msg"; key: string; msg: ChatMessage; mine: boolean; showName: boolean; showTime: boolean };

// 카톡처럼 묶기: 날짜가 바뀌면 구분선, 같은 사람이 같은 분에 연달아 보내면 이름은 첫 줄만·시각은 마지막 줄만
export function buildRows(messages: ChatMessage[], meId: string): ChatRow[] {
  const rows: ChatRow[] = [];
  const minute = (iso: string) => kst(iso).toISOString().slice(0, 16);
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) rows.push({ type: "date", key: `d-${dayKey(m.created_at)}`, label: dateLabel(m.created_at) });
    if (m.kind === "notice") {
      rows.push({ type: "notice", key: m.id, msg: m });
      continue;
    }
    if (m.kind === "bot") {
      rows.push({ type: "bot", key: m.id, msg: m });
      continue;
    }
    if (m.kind === "system") {
      rows.push({ type: "system", key: m.id, msg: m });
      continue;
    }
    const sameAsPrev = !!prev && prev.kind !== "system" && prev.sender_member_id === m.sender_member_id && minute(prev.created_at) === minute(m.created_at) && dayKey(prev.created_at) === dayKey(m.created_at);
    const sameAsNext = !!next && next.kind !== "system" && next.sender_member_id === m.sender_member_id && minute(next.created_at) === minute(m.created_at);
    rows.push({ type: "msg", key: m.id, msg: m, mine: m.sender_member_id === meId, showName: !sameAsPrev, showTime: !sameAsNext });
  }
  return rows;
}

// 실시간·다시 불러오기로 들어온 메시지를 합친다(같은 id는 새 것으로, 시간순)
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) {
    const old = map.get(m.id);
    map.set(m.id, old?.localUrl && !m.pending ? { ...m, localUrl: old.localUrl } : m);
  }
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

// 이름 첫 글자 동그라미 색(사람마다 같은 색)
const AVATAR_COLORS = ["bg-sky-200 text-sky-900", "bg-amber-200 text-amber-900", "bg-emerald-200 text-emerald-900", "bg-rose-200 text-rose-900", "bg-violet-200 text-violet-900", "bg-lime-200 text-lime-900"];
export function avatarColor(id: string | null): string {
  if (!id) return "bg-zinc-200 text-zinc-700";
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 저장 공간 표시(D-212 관리자 [채팅]): 1GB 미만은 MB 정수, 이상은 GB 소수 한 자리 — "320MB" / "1GB" / "1.2GB"
export function bytesLabel(bytes: number): string {
  const mb = 1024 * 1024;
  if (bytes < 1024 * mb) return `${Math.max(0, Math.round(bytes / mb))}MB`;
  return `${Math.round((bytes / (1024 * mb)) * 10) / 10}GB`;
}

export const CHAT_FILE_MAX = 20 * 1024 * 1024;
export const CHAT_BODY_MAX = 4000;

// 알림 한 줄(D-214): 줄바꿈·여러 칸을 한 칸으로, 길면 끝을 …로
export function oneLine(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// 회의 10분 전 알림 글 → 카드(D-217). 글 모양: "회의 시작 10분 전입니다.\n14:00~15:00 제목\n장소: …\n안건: …\n자료: n개"
export type MeetingNoticeCard = { time: string; title: string; place: string | null; agenda: string | null; files: number };
export function meetingNoticeCard(body: string | null): MeetingNoticeCard | null {
  const lines = (body ?? "").split("\n");
  if (lines[0] !== "회의 시작 10분 전입니다." || !lines[1]) return null;
  const m = lines[1].match(/^(\d{2}:\d{2}~\d{2}:\d{2})\s+(.+)$/);
  if (!m) return null;
  const field = (k: string) => lines.slice(2).find((l) => l.startsWith(`${k}: `))?.slice(k.length + 2) ?? null;
  return { time: m[1], title: m[2], place: field("장소"), agenda: field("안건"), files: Number(field("자료")?.replace(/개$/, "") ?? 0) || 0 };
}

// 도우미 답의 [열기] 버튼 글자(D-222) — 주소로 정한다
export function assistantLinkLabel(link: string): string {
  const p = link.replace(/^\/workspace\/[^/]+/, "");
  if (p.includes("#notices")) return "공지 보기";
  if (p.startsWith("/admin/export")) return "세무 마감 열기";
  if (p.startsWith("/admin/recurring")) return "정기 결제 보기";
  if (p.startsWith("/admin/corporate-cards")) return "카드 대조 열기";
  if (p.startsWith("/calendar/rooms")) return "회의실 예약 열기";
  if (p.startsWith("/calendar")) return "캘린더에서 보기";
  if (/^\/employee\/claims\/[^/]+/.test(p)) return "결의서 열기";
  if (p.startsWith("/employee/settlements") || p.startsWith("/admin/payouts")) return "정산 화면 열기";
  if (p.startsWith("/employee/profile")) return "내 정보 열기";
  if (p.startsWith("/employee/attendance")) return "내 근태 보기";
  if (p.startsWith("/admin/attendance")) return "근태 승인 열기";
  if (p.startsWith("/employee")) return "내 결의서 보기";
  if (p.startsWith("/admin/claims") || p.startsWith("/approvals")) return "결재하러 가기";
  if (p.startsWith("/chat")) return "채팅 목록 열기";
  return "화면 열기";
}

// 앱 알림 카드(D-224): 첫 줄 = 제목, 나머지 줄은 "이름: 값"(짧은 이름)이면 표처럼, 아니면 글로
export function noticeCard(body: string | null): { title: string; rows: { label: string | null; value: string }[] } {
  const lines = (body ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines[0] ?? "알림";
  const rows = lines.slice(1).map((l) => {
    const m = l.match(/^([^:：]{1,8})\s*[:：]\s*(.+)$/);
    return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: l };
  });
  return { title, rows };
}

