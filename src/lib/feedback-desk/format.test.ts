import { describe, expect, it } from "vitest";
import { FEEDBACK_DONE, FEEDBACK_ERROR, feedbackInputError, feedbackNotifyText, feedbackPagePath, userAgentSummary, viewportLabel } from "./format";
import { BRAND } from "@/lib/brand";

describe("의견 보내기 (D-246)", () => {
  it("구분·길이 검사", () => {
    expect(feedbackInputError(null, "다섯 글자 이상")).toBe(FEEDBACK_ERROR.category);
    expect(feedbackInputError("idea", "다섯 글자 이상")).toBe(FEEDBACK_ERROR.category);
    expect(feedbackInputError("bug", "  짧음 ")).toBe(FEEDBACK_ERROR.short);
    expect(feedbackInputError("feature", "가".repeat(2001))).toBe(FEEDBACK_ERROR.long);
    expect(feedbackInputError("bug", "승인이 안 돼요")).toBeNull();
  });

  it("화면 주소는 경로만", () => {
    expect(feedbackPagePath("https://a.app/workspace/1/admin?token=abc#x")).toBe("/workspace/1/admin");
    expect(feedbackPagePath("/employee/claims?tab=1")).toBe("/employee/claims");
  });

  it("화면 크기·브라우저 요약", () => {
    expect(viewportLabel(1280.4, 719.6)).toBe("1280x720");
    expect(userAgentSummary("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36")).toBe("윈도우 · 크롬");
    expect(userAgentSummary("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18 Safari/604.1")).toBe("아이폰·아이패드 · 사파리");
    expect(userAgentSummary("Mozilla/5.0 (Linux; Android 14) SamsungBrowser/25 Chrome/120")).toBe("안드로이드 · 삼성 인터넷");
    expect(userAgentSummary(null)).toBe("알 수 없음");
  });

  it("운영자 알림은 첫 줄 60자", () => {
    const t = feedbackNotifyText("예시 회사", "김대리", "bug", `${"가".repeat(70)}\n둘째 줄`, true);
    expect(t).toContain(`🐛 [${BRAND.name}] 버그 신고: 예시 회사 · 김대리 · 캡처 있음`);
    expect(t).toContain(`${"가".repeat(60)}…`);
    expect(t).not.toContain("둘째 줄");
  });

  it(`안내 문구: 버그는 24시간 안에 확인, 기능 개선은 ${BRAND.name}`, () => {
    expect(FEEDBACK_DONE.bug.paragraphs.join(" ")).toContain("24시간 안에 확인");
    expect(FEEDBACK_DONE.feature.paragraphs.join(" ")).toContain(BRAND.name);
    expect(FEEDBACK_DONE.feature.paragraphs.join(" ")).not.toContain("모아온");
  });
});
