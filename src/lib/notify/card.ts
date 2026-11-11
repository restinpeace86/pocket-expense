import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { BuiltMessage } from "./templates";
import { pushOf } from "./channel";

// 앱 알림을 채팅 [알림]방 카드로도(D-224, spec/screens/notification-rule.md §0-3)
// 핵심 알림(알림톡 6종 — 초대·결재 요청·반려·독촉·세무 자료 요청)은 빼고, 앱 알림만 가던 것들을 함께 넣는다.
// 카드 글 = 첫 줄 제목 + 나머지 줄 내용, link = [열기]. 메신저가 꺼진 회사는 DB 함수가 넣지 않는다(앱 알림만).
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type NoticeCard = { title: string; lines: string[]; url: string | null };

// 알림톡 문구 → 카드(머리말 "[Moa-on] …" 줄은 제목이 대신)
export function cardOf(m: BuiltMessage): NoticeCard {
  const lines = m.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rest = (lines.length > 1 ? lines.slice(1) : lines.map((l) => l.replace(/^\[Moa-on\]\s*/, ""))).map((l) => l.replace(/^[▶•·\-\s]+/, ""));
  return { title: pushOf(m).title, lines: rest, url: m.buttonPath };
}

export async function postNoticeCards(admin: Admin, companyId: string, memberIds: string[], card: NoticeCard): Promise<number> {
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (!ids.length) return 0;
  const body = [card.title, ...card.lines.map((l) => l.slice(0, 200))].join("\n");
  const { data } = await admin.rpc("chat_post_notices", { p_company: companyId, p_members: ids, p_body: body, p_link: card.url ?? (null as unknown as string) });
  return (data as number | null) ?? 0;
}
