import { describe, expect, it } from "vitest";
import { feedbackUrl } from "./feedback";

describe("feedbackUrl", () => {
  it("카카오톡 채널 채팅 주소만 받는다", () => {
    expect(feedbackUrl("https://pf.kakao.com/_AbC12/chat")).toBe("https://pf.kakao.com/_AbC12/chat");
    expect(feedbackUrl("  https://pf.kakao.com/_AbC12/chat/ ")).toBe("https://pf.kakao.com/_AbC12/chat/");
  });
  it("비었거나 다른 주소면 숨긴다", () => {
    expect(feedbackUrl(undefined)).toBeNull();
    expect(feedbackUrl("")).toBeNull();
    expect(feedbackUrl("http://pf.kakao.com/_AbC12/chat")).toBeNull();
    expect(feedbackUrl("https://evil.example/_AbC12/chat")).toBeNull();
    expect(feedbackUrl("https://pf.kakao.com/_AbC12")).toBeNull();
  });
});
