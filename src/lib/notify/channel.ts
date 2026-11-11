// 알림 길 나누기(D-213, 사용자 결정 2026-11-05: "카카오 알림은 정말 중요한 것만 최소화"). 순수 함수라 단위 테스트한다.
// - alimtalk: 늘 알림톡 — 받는 사람이 아직 회원이 아니라 앱 알림을 받을 수 없다(초대).
// - fallback: 앱 알림(웹푸시) 먼저, 이 사람의 기기 중 하나도 받지 못하면(알림을 안 켬·막힘·아이폰 홈 화면 앱 아님) 알림톡.
//             놓치면 일이 멈추거나 돈·마감이 걸린 것만.
// - push: 앱 알림만(알림톡 안 감). 알려 주면 좋은 소식이고 앱 화면(홈·내역)에서도 보인다.
import type { BuiltMessage, TemplateCode } from "./templates";

export type Channel = "alimtalk" | "fallback" | "push";

export const CHANNEL: Record<TemplateCode, Channel> = {
  INVITE: "alimtalk",
  TAX_OFFICE_INVITE: "alimtalk",
  APPROVAL_REQUEST: "fallback", // 결재자가 못 보면 결재가 멈춘다
  APPROVAL_REJECTED: "fallback", // 고쳐서 다시 올려야 돈을 받는다
  REMINDER: "fallback", // 관리자가 직접 누른 독촉 — 앱을 안 보는 사람에게 가야 의미가 있다
  TAX_REQUEST: "fallback", // 세무사무소가 답을 기다린다(마감)
  APPROVAL_COMPLETED: "push",
  PAYOUT_COMPLETED: "push",
  RECURRING_READY: "push",
  CLOSING: "push",
  TAX_CLOSED: "push",
};

// pushed: 이 사람이 앱 알림을 하나라도 받았는지
// alimtalkOn: 회사가 카카오 알림톡 추가 서비스를 켰는지(D-247, company_features 'alimtalk' — 기본 꺼짐).
// 꺼져 있으면 핵심 알림도 앱 안(앱 알림 + 채팅 [알림]방 카드)으로만 간다. 초대는 받는 사람이 아직 회원이 아니라 그대로 알림톡
export function needsAlimtalk(code: TemplateCode, pushed: boolean, alimtalkOn = false): boolean {
  const c = CHANNEL[code];
  return c === "alimtalk" || (c === "fallback" && alimtalkOn && !pushed);
}

const PUSH_TITLE: Partial<Record<TemplateCode, string>> = {
  APPROVAL_REQUEST: "결재 요청이 왔어요",
  APPROVAL_COMPLETED: "결재가 완료됐어요",
  APPROVAL_REJECTED: "지출결의서가 반려됐어요",
  PAYOUT_COMPLETED: "정산금이 지급됐어요",
  REMINDER: "아직 제출하지 않은 결의서가 있어요",
  RECURRING_READY: "정기 결제 결의서를 확인해 주세요",
};

// 알림톡 문구 → 앱 알림(제목 + 한 줄 요약). "[Moa-on] 머리말" 줄은 제목이 대신하고, 나머지 줄은 " · "로 잇는다
export function pushOf(m: BuiltMessage, tag?: string): { title: string; body: string; url: string; tag?: string } {
  const lines = m.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const after = lines.length > 1 ? lines.slice(1) : lines;
  // "이름: 값" 줄이 있으면 그것만(안내 문장은 제목이 대신, D-226) — 앱 알림은 짧게
  const keyed = after.filter((l) => /^[^:]{1,8}:\s/.test(l));
  const rest = keyed.length ? keyed : after;
  const body = rest
    .map((l) => l.replace(/^\[Moa-on\]\s*/, "").replace(/^[▶•·\-\s]+/, ""))
    .join(" · ");
  return { title: PUSH_TITLE[m.template] ?? "Moa-on", body: body.length > 150 ? `${body.slice(0, 149)}…` : body, url: m.buttonPath, ...(tag ? { tag } : {}) };
}
