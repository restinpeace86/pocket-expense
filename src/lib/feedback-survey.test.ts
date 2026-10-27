import { describe, expect, it } from "vitest";
import { authorLabel, isValidSurvey } from "./feedback-survey";

describe("후기·설문", () => {
  it("작성자는 규모·업종·직무로만 익명 표시", () => {
    expect(authorLabel({ industry: "construction", company_size: "5-10", job_role: "site_manager" })).toBe("10인 이하 건설업 현장 소장");
    expect(authorLabel({ industry: "other", company_size: "1-4", job_role: "ceo" })).toBe("5인 미만 대표");
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
