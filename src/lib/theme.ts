// 화면 색상 팔레트 목록 (D-066). 색 값 자체는 src/app/globals.css의 [data-theme] 블록에 있다.
// 목록을 바꾸면 globals.css와 이 목록을 함께 고친다. 대비 기준은 globals.css 주석 참고.
export const THEMES = [
  { key: "navy", label: "A · 딥 네이비", hint: "기본", swatch: ["#0f172a", "#4f46e5"] },
  { key: "light", label: "B · 화이트", hint: "밝고 깔끔하게", swatch: ["#f7f7f9", "#4f46e5"] },
  { key: "emerald", label: "C · 차콜·에메랄드", hint: "차분하게", swatch: ["#1c1f24", "#047857"] },
  { key: "wine", label: "D · 와인", hint: "깊고 따뜻하게", swatch: ["#2b0f17", "#be123c"] },
  { key: "amber", label: "E · 웜 오렌지", hint: "밝고 활기 있게", swatch: ["#fbf7f2", "#c2410c"] },
  { key: "ocean", label: "F · 딥 오션", hint: "시원하게", swatch: ["#0b2530", "#0369a1"] },
  { key: "violet", label: "G · 바이올렛", hint: "부드럽게", swatch: ["#f8f6fc", "#7c3aed"] },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];
export const DEFAULT_THEME: ThemeKey = "navy";
export const THEME_STORAGE_KEY = "pe-theme";
export const THEME_KEYS: readonly string[] = THEMES.map((t) => t.key);
export const isThemeKey = (v: unknown): v is ThemeKey => typeof v === "string" && THEME_KEYS.includes(v);
