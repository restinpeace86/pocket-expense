// 도움말 글 모양·고르기(D-251 → D-255). 글은 DB(help_articles·help_steps)에 있고, 처음 데이터는 seed.ts
// AI 답변은 이 글들만 보고 한다(지어내지 않게). path = `/workspace/{회사}` 뒤 주소 → [이동]
export type HelpCategory = "basic" | "expense" | "attendance" | "convert" | "together";
export type HelpFeature = "attendance" | "calendar" | "chat" | "bus";
export type HelpFeatures = Record<HelpFeature, boolean>;
export type HelpStep = { body: string; image: string | null; alt: string | null };
export type HelpGuide = {
  id: string;
  cat: HelpCategory;
  audience: "all" | "admin";
  title: string;
  summary: string;
  steps: HelpStep[];
  path?: string | null;
  adminPath?: string | null;
  pathLabel?: string | null;
  keywords: string[];
  needs?: HelpFeature | null;
  sim?: string | null;
};

export const HELP_CATEGORIES: { key: HelpCategory; label: string }[] = [
  { key: "basic", label: "기본 설정" },
  { key: "expense", label: "경비" },
  { key: "attendance", label: "근태/신청" },
  { key: "convert", label: "서류·양식" },
  { key: "together", label: "채팅·캘린더" },
];

export const ALL_FEATURES: HelpFeatures = { attendance: true, calendar: true, chat: true, bus: true };
// 직원에겐 관리자 글을 빼고, 회사가 쓰지 않는 기능 글도 뺀다(꺼진 회사에서 없는 화면으로 가지 않게)
export function guidesFor(list: HelpGuide[], admin: boolean, has: HelpFeatures = ALL_FEATURES): HelpGuide[] {
  return list.filter((g) => (admin || g.audience === "all") && (!g.needs || has[g.needs]));
}

export function guidePath(g: HelpGuide, admin: boolean): string | null {
  return (admin && g.adminPath) || g.path || null;
}

// 질문과 가까운 글 고르기: 키워드·제목·요약·단계 글에 겹치는 말(2글자 조각) 점수. AI에는 상위 몇 편만 넘긴다
const grams = (t: string) => {
  const s = t.toLowerCase().replace(/[^0-9a-z가-힣]+/g, " ");
  const out = new Set<string>();
  for (const w of s.split(" ").filter(Boolean)) {
    if (w.length === 1) out.add(w);
    for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
  }
  return out;
};
export function rankGuides(q: string, list: HelpGuide[], n = 4): HelpGuide[] {
  const qg = grams(q);
  if (!qg.size) return [];
  const lq = q.toLowerCase();
  const scored = list.map((g) => {
    let score = 0;
    for (const k of g.keywords) if (lq.includes(k.toLowerCase())) score += 6;
    const tg = grams(g.title);
    const kg = grams(g.keywords.join(" "));
    const bg = grams(`${g.summary} ${g.steps.map((s) => s.body).join(" ")}`);
    for (const x of qg) score += (tg.has(x) ? 3 : 0) + (kg.has(x) ? 2 : 0) + (bg.has(x) ? 1 : 0);
    return { g, score };
  });
  return scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.g);
}

// 단어 하나(띄어쓰기 없음, 짧음)면 AI 없이 맞는 글만 바로 보여 준다(하루 횟수도 안 씀)
export function isShortQuery(q: string): boolean {
  const t = q.trim();
  return t.length >= 1 && !/\s/.test(t) && t.length <= 8;
}
