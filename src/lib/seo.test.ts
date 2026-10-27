import { describe, expect, it } from "vitest";
import { ROBOTS_DISALLOW, verificationTags } from "./seo";

describe("검색 사이트 소유 확인 태그", () => {
  it("값이 있는 것만 넣는다", () => {
    expect(verificationTags({})).toBeUndefined();
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: " g123 ", NAVER_SITE_VERIFICATION: "" })).toEqual({ google: "g123" });
    expect(verificationTags({ NAVER_SITE_VERIFICATION: "n456" })).toEqual({ other: { "naver-site-verification": "n456" } });
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: "g", NAVER_SITE_VERIFICATION: "n" })).toEqual({ google: "g", other: { "naver-site-verification": "n" } });
  });
  it("로그인 뒤 화면·운영자 화면은 검색 로봇에서 막는다", () => {
    for (const p of ["/workspace/", "/app-admin", "/onboarding", "/api/"]) expect(ROBOTS_DISALLOW).toContain(p);
  });
});
