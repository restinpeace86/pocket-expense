import { describe, expect, it } from "vitest";
import { isTestCompany, opsPayload, opsSummary } from "./format";

const NOW = new Date("2026-11-18T03:00:00Z");

describe("운영자 디스코드 알림(D-293)", () => {
  it("요약: 한 줄·100자·개인정보 모양 가림", () => {
    expect(opsSummary("첫 줄\n\n둘째   줄")).toBe("첫 줄 둘째 줄");
    expect(opsSummary("가".repeat(120))).toBe(`${"가".repeat(100)}…`);
    const s = opsSummary("연락은 kim@example.com 또는 010-1234-5678, 사업자 123-45-67890");
    expect(s).not.toMatch(/kim@|1234-5678|67890/);
    expect(s).toContain("(이메일)");
    expect(s).toContain("(전화번호)");
    expect(s).toContain("(사업자번호)");
  });

  it("신규 가입: 회사 이름 + 운영자 회사 화면 링크", () => {
    const p = opsPayload({ kind: "signup", company: "예시 회사", companyId: "abc" }, "https://damo-on.com/", NOW).embeds[0];
    expect(p.title).toBe("🏢 신규 회사 가입");
    expect(p.description).toBe("**예시 회사**");
    expect(p.url).toBe("https://damo-on.com/app-admin/companies/abc");
    expect(p.timestamp).toBe(NOW.toISOString());
  });

  it("의견: 구분·회사·요약, 보낸 사람 이름 없음", () => {
    const p = opsPayload({ kind: "feedback", company: "예시 회사", category: "bug", content: "저장이 안 돼요\n두번째", hasShot: true }, "https://damo-on.com", NOW).embeds[0];
    expect(p.title).toContain("버그 신고");
    expect(p.description).toBe("**예시 회사** · 캡처 있음\n> 저장이 안 돼요 두번째");
    expect(p.url).toBe("https://damo-on.com/app-admin/feedback");
  });

  it("저장 공간·양식·후기 링크와 문구", () => {
    expect(opsPayload({ kind: "storage", company: "A", gb: 10 }, "https://x.com", NOW).embeds[0].description).toBe("**A** · 10GB");
    expect(opsPayload({ kind: "storage", company: "A", gb: 0 }, "https://x.com", NOW).embeds[0].description).toContain("해지");
    expect(opsPayload({ kind: "format", company: "A", program: "이카운트 ERP" }, "https://x.com", NOW).embeds[0].url).toBe("https://x.com/app-admin/format-requests");
    const r = opsPayload({ kind: "review", company: "A", rating: 4, review: "좋아요" }, "https://x.com", NOW).embeds[0];
    expect(r.description).toBe("**A** · ★★★★☆\n> 좋아요");
    expect(r.url).toBe("https://x.com/app-admin/reviews");
  });

  it("자동 점검(smoke-e2e) 회사는 제목에 테스트 표시", () => {
    expect(isTestCompany("smoke-e2e-123 테스트회사")).toBe(true);
    expect(opsPayload({ kind: "signup", company: "smoke-e2e-1 테스트회사", companyId: "x" }, "https://x.com", NOW).embeds[0].title).toBe("🧪 테스트 · 🏢 신규 회사 가입");
    expect(opsPayload({ kind: "signup", company: "실제 회사", companyId: "x" }, "", NOW).embeds[0].url).toBeUndefined();
  });
});
