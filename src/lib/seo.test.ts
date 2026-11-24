import { describe, expect, it } from "vitest";
import { PUBLIC_UPDATED, ROBOTS_DISALLOW, SITE_DESCRIPTION, structuredData, verificationTags } from "./seo";

describe("검색 사이트 소유 확인 태그", () => {
  it("값이 있는 것만 넣는다", () => {
    expect(verificationTags({})).toBeUndefined();
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: " g123 ", NAVER_SITE_VERIFICATION: "" })).toEqual({ google: "g123" });
    expect(verificationTags({ NAVER_SITE_VERIFICATION: "n456" })).toEqual({ other: { "naver-site-verification": "n456" } });
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: "g", NAVER_SITE_VERIFICATION: "n" })).toEqual({ google: "g", other: { "naver-site-verification": "n" } });
  });
  it("로그인 뒤 화면·운영자 화면은 검색 로봇에서 막는다", () => {
    for (const p of ["/workspace/", "/app-admin", "/onboarding", "/api/", "/account/"]) expect(ROBOTS_DISALLOW).toContain(p);
  });
});

describe("검색 정보 보강(D-313)", () => {
  it("설명에 근태·휴가·전자결재가 들어감", () => {
    for (const w of ["출퇴근", "연차", "전자결재"]) expect(SITE_DESCRIPTION).toContain(w);
  });
  it("사이트맵 날짜는 고정 날짜", () => {
    expect(PUBLIC_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("구조화 데이터: 회사·사이트·서비스, 가격·별점·전화 없음", () => {
    const d = structuredData("https://damo-on.com", { name: "다모은랩", email: "a@b.c" });
    const types = d["@graph"].map((x) => x["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    const s = JSON.stringify(d);
    for (const k of ["offers", "aggregateRating", "telephone"]) expect(s).not.toContain(k);
  });
});
