import { describe, expect, it } from "vitest";
import { aiCategoryOf, categoryMismatch } from "./category-check";

describe("categoryMismatch — DB category_mismatch와 같은 규칙 (D-104)", () => {
  it("다른 묶음이면 경고", () => {
    expect(categoryMismatch("meal", "purchase")).toBe(true);
    expect(categoryMismatch("purchase", "meal")).toBe(true);
    expect(categoryMismatch("meal", "trip")).toBe(true);
    expect(categoryMismatch("team_dinner", "purchase")).toBe(true);
  });
  it("같은 식사류(식대·미팅·회식)는 경고 없음", () => {
    expect(categoryMismatch("meeting", "meal")).toBe(false);
    expect(categoryMismatch("team_dinner", "meal")).toBe(false);
    expect(categoryMismatch("meal", "meeting")).toBe(false);
  });
  it("출장 결의서·그 밖의 카테고리·AI 결과 없음은 비교하지 않음", () => {
    expect(categoryMismatch("trip", "meal")).toBe(false);
    expect(categoryMismatch("books", "purchase")).toBe(false);
    expect(categoryMismatch("meal", null)).toBe(false);
    expect(categoryMismatch(null, "meal")).toBe(false);
  });
  it("AI 추천 값", () => {
    expect(aiCategoryOf({ suggested_category: "purchase" })).toBe("purchase");
    expect(aiCategoryOf({ suggested_category: "travel" })).toBeNull();
    expect(aiCategoryOf(null)).toBeNull();
  });
});
