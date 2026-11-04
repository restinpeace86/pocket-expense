// 채팅 색감(D-211, 계정별 — members.chat_theme). 색 값은 src/app/globals.css의 html[data-chat-theme] 블록.
// 카톡과 헷갈리지 않게 업무형 두 가지를 고를 수 있다. 기본은 지금 색 그대로
export const CHAT_THEMES = [
  { key: "basic", label: "기본", hint: "하늘 배경 · 노란 말풍선", swatch: ["#b2c7da", "#fee500"] },
  { key: "line", label: "업무형 · 테두리", hint: "흰 배경 · 남색 테두리", swatch: ["#fafbfc", "#1e3a8a"] },
  { key: "cool", label: "업무형 · 쿨톤", hint: "연한 회청 · 하늘빛 말풍선", swatch: ["#eef2f7", "#dbe7f6"] },
] as const;

export type ChatThemeKey = (typeof CHAT_THEMES)[number]["key"];
export const DEFAULT_CHAT_THEME: ChatThemeKey = "basic";
export const CHAT_THEME_STORAGE_KEY = "pe-chat-theme";
export const CHAT_THEME_KEYS: readonly string[] = CHAT_THEMES.map((t) => t.key);
export const isChatThemeKey = (v: unknown): v is ChatThemeKey => typeof v === "string" && CHAT_THEME_KEYS.includes(v);
