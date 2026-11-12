// 랜딩 구역 보조색(9-15, D-263) — 브랜드 인디고 하나를 중심으로 구역마다 색 하나.
// 경비·결재 인디고 · 근태·휴가 청록 · 협업 주황 · 문서·양식 하늘 · 세무 연계 분홍.
// Tailwind가 찾을 수 있게 클래스 문자열을 통째로 적는다(조합해 만들지 않는다)
export type Accent = "expense" | "attend" | "collab" | "docs" | "tax";

export const ACCENT: Record<Accent, { tile: string; soft: string; text: string; band: string; check: string; card: string; chip: string }> = {
  expense: { tile: "bg-indigo-600 text-white", soft: "bg-indigo-50 text-indigo-600", text: "text-indigo-700", band: "bg-indigo-600", check: "text-indigo-600", card: "from-indigo-50 to-indigo-100/70", chip: "bg-indigo-50 text-indigo-700" },
  attend: { tile: "bg-teal-600 text-white", soft: "bg-teal-50 text-teal-600", text: "text-teal-700", band: "bg-teal-600", check: "text-teal-600", card: "from-teal-50 to-teal-100/70", chip: "bg-teal-50 text-teal-700" },
  collab: { tile: "bg-amber-600 text-white", soft: "bg-amber-50 text-amber-600", text: "text-amber-700", band: "bg-amber-500", check: "text-amber-600", card: "from-amber-50 to-amber-100/70", chip: "bg-amber-50 text-amber-800" },
  docs: { tile: "bg-sky-600 text-white", soft: "bg-sky-50 text-sky-600", text: "text-sky-700", band: "bg-sky-600", check: "text-sky-600", card: "from-sky-50 to-sky-100/70", chip: "bg-sky-50 text-sky-700" },
  tax: { tile: "bg-pink-600 text-white", soft: "bg-pink-50 text-pink-600", text: "text-pink-700", band: "bg-pink-600", check: "text-pink-600", card: "from-pink-50 to-pink-100/70", chip: "bg-pink-50 text-pink-700" },
};

// 브랜드 버튼(인디고→보라) — 랜딩의 주요 버튼은 모두 이것
export const BRAND_BUTTON = "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500";
