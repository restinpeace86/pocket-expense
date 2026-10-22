// 결의서 카테고리와 AI가 본 영수증 종류 비교 (D-104) — DB private.category_mismatch(migration 052)와 같은 규칙
// 묶음: 식사류(식대·미팅·회식) / 물품 / 출장. AI는 4대 카테고리만 추천하므로 그 밖의 카테고리와 출장 결의서는 비교하지 않는다.
import type { ExpenseCategory } from "./categories";

export function categoryGroup(c: string | null | undefined): "food" | "goods" | "trip" | null {
  if (c === "meal" || c === "meeting" || c === "team_dinner") return "food";
  if (c === "purchase") return "goods";
  if (c === "trip") return "trip";
  return null;
}

export function categoryMismatch(claim: ExpenseCategory | null, ai: string | null | undefined): boolean {
  if (!claim || claim === "trip") return false;
  const a = categoryGroup(claim);
  const b = categoryGroup(ai);
  return !!a && !!b && a !== b;
}

// AI 추천 값이 4대 카테고리면 그 값(새 결의서로 옮길 곳)
export function aiCategoryOf(payload: unknown): ExpenseCategory | null {
  const v = payload && typeof payload === "object" ? (payload as Record<string, unknown>).suggested_category : null;
  return v === "meal" || v === "meeting" || v === "purchase" || v === "trip" ? v : null;
}
