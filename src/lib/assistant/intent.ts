// WORKON 도우미 1단계(D-222, spec/features/assistant.md): 조회·화면 이동만.
// 질문 → 무엇을 할지(intent). 흔한 말은 규칙으로 바로 알아듣고(AI 비용 없음), 못 알아들으면 서버가 Gemini에 같은 모양으로 물어본다.
// 순수 함수라 단위 테스트한다. 날짜는 한국 시간 기준 YYYY-MM-DD.

export type OpenTarget = "calendar" | "rooms" | "claims" | "new_claim" | "approvals" | "settlements" | "chat" | "profile";
export type Intent =
  | { tool: "schedule"; day: string }
  | { tool: "rooms"; day: string; room?: string }
  | { tool: "my_claims"; filter: "draft" | "rejected" | "open" }
  | { tool: "approvals" }
  | { tool: "open"; target: OpenTarget }
  | { tool: "help" }
  | { tool: "unsupported" };

export const OPEN_TARGETS: OpenTarget[] = ["calendar", "rooms", "claims", "new_claim", "approvals", "settlements", "chat", "profile"];

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

// "오늘·내일·모레·글피", "11월 7일", "11/7", "7일"(이번 달) → 날짜. 못 찾으면 null
export function parseDay(text: string, today: string): string | null {
  const t = text.replace(/\s+/g, "");
  if (/글피/.test(t)) return addDays(today, 3);
  if (/모레/.test(t)) return addDays(today, 2);
  if (/내일/.test(t)) return addDays(today, 1);
  if (/오늘|지금/.test(t)) return today;
  const y = Number(today.slice(0, 4));
  const md = t.match(/(\d{1,2})월(\d{1,2})일/) ?? t.match(/(?<![\d.])(\d{1,2})[/.](\d{1,2})(?![\d])/);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      let year = y;
      // 이미 지난 달이면(예: 12월에 "1월 3일") 내년
      if (m < Number(today.slice(5, 7)) - 6) year += 1;
      return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const only = t.match(/(?<![\d월/.])(\d{1,2})일/);
  if (only) {
    const d = Number(only[1]);
    if (d >= 1 && d <= 31) return `${today.slice(0, 8)}${String(d).padStart(2, "0")}`;
  }
  return null;
}

const OPEN_VERB = /(열어|열기|가줘|가 줘|가고|이동|바로가기|띄워|보여줘 ?화면|화면)/;
const TARGET_WORDS: [OpenTarget, RegExp][] = [
  ["rooms", /회의실/],
  ["new_claim", /(새|새로운)\s*(결의서|경비)|결의서\s*(쓰기|작성|만들)|경비\s*(올리기|청구)/],
  ["approvals", /결재함|승인\s*(관리|화면)|결재\s*화면/],
  ["settlements", /정산/],
  ["calendar", /캘린더|달력|일정/],
  ["claims", /결의서|경비/],
  ["profile", /내\s*정보|프로필|알림\s*설정/],
  ["chat", /채팅|메신저/],
];

// 규칙으로 알아듣기. 못 알아들으면 null(→ 서버가 AI에)
export function ruleIntent(raw: string, today: string): Intent | null {
  const text = raw.replace(/@workon/gi, " ").trim();
  if (!text) return { tool: "help" };
  if (/^(도움말?|help|\?|뭐\s*할\s*수|무엇을\s*할|사용법|안녕)/i.test(text) || /할\s*수\s*있는\s*(게|것|일)/.test(text)) return { tool: "help" };
  const day = parseDay(text, today);

  // 화면 열기: "회의실 예약 화면 열어줘", "새 결의서 쓰기"
  if (OPEN_VERB.test(text) || /(쓰기|작성)$/.test(text)) {
    for (const [target, re] of TARGET_WORDS) if (re.test(text)) return { tool: "open", target };
  }
  if (/회의실/.test(text) && /(비|빈|예약\s*가능|남|언제|현황|몇\s*시)/.test(text)) {
    const room = text.match(/([0-9A-Za-z가-힣]+\s*회의실)/)?.[1]?.replace(/\s+/g, " ");
    const named = room && !/^(빈|비어|회|오늘|내일|모레|글피|지금|\d{1,2}일)/.test(room) ? room : undefined;
    return { tool: "rooms", day: day ?? today, ...(named ? { room: named } : {}) };
  }
  if (/(승인|결재)\s*(대기|할|해야|기다|남은|올라온)|결재함/.test(text)) return { tool: "approvals" };
  if (/반려/.test(text)) return { tool: "my_claims", filter: "rejected" };
  if (/(임시\s*저장|작성\s*중|미제출|안\s*낸|안\s*올린|못\s*올린|올리다)/.test(text)) return { tool: "my_claims", filter: "draft" };
  if (/(결의서|경비|정산)/.test(text) && /(내|남은|미처리|처리\s*안|밀린|할\s*일|있어|확인)/.test(text)) return { tool: "my_claims", filter: "open" };
  if (/(일정|스케줄|약속|회의|미팅|출장|외근)/.test(text) && !/회의실/.test(text)) return { tool: "schedule", day: day ?? today };
  return null;
}

// AI가 돌려준 값을 믿을 수 있는 모양으로만 받는다(모르는 값은 unsupported)
export function normalizeAiIntent(v: unknown, today: string): Intent {
  const o = (v ?? {}) as Record<string, unknown>;
  const day = typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : today;
  switch (o.tool) {
    case "schedule":
      return { tool: "schedule", day };
    case "rooms":
      return { tool: "rooms", day, ...(typeof o.room === "string" && o.room.trim() ? { room: o.room.trim().slice(0, 40) } : {}) };
    case "my_claims":
      return { tool: "my_claims", filter: o.filter === "draft" || o.filter === "rejected" ? o.filter : "open" };
    case "approvals":
      return { tool: "approvals" };
    case "open":
      return OPEN_TARGETS.includes(o.target as OpenTarget) ? { tool: "open", target: o.target as OpenTarget } : { tool: "unsupported" };
    case "help":
      return { tool: "help" };
    default:
      return { tool: "unsupported" };
  }
}

export const ASSISTANT_DAILY_LIMIT = 30;
