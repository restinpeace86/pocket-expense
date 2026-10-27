import { describe, expect, it } from "vitest";
import { authorLabel, isDisplayableReview, isValidSurvey } from "./feedback-survey";

describe("후기·설문", () => {
  it("작성자는 규모·업종·직무로만 익명 표시", () => {
    expect(authorLabel({ industry: "construction", company_size: "5-10", job_role: "site_manager" })).toBe("10인 이하 건설업 현장 소장");
    expect(authorLabel({ industry: "other", company_size: "1-4", job_role: "ceo" })).toBe("5인 미만 대표");
  });
  it("랜딩에는 공백 빼고 10자 이상만", () => {
    expect(isDisplayableReview("좋아요")).toBe(false);
    expect(isDisplayableReview("좋 아 요 좋 아 요 좋 아")).toBe(false); // 공백 빼면 8자
    expect(isDisplayableReview("월말 정리가 정말 편해졌어요")).toBe(true);
    expect(isDisplayableReview(null)).toBe(false);
  });
  it("선택지 밖 값·별점·긴 후기는 거절", () => {
    const ok = { rating: 5, usefulFeature: "receipt_ai", industry: "it", companySize: "1-4", jobRole: "ceo", review: "" };
    expect(isValidSurvey(ok)).toBe(true);
    expect(isValidSurvey({ ...ok, rating: 0 })).toBe(false);
    expect(isValidSurvey({ ...ok, rating: 4.5 })).toBe(false);
    expect(isValidSurvey({ ...ok, industry: "space" })).toBe(false);
    expect(isValidSurvey({ ...ok, review: "가".repeat(101) })).toBe(false);
  });
});
