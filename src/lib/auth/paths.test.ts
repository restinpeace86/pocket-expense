import { describe, expect, it } from "vitest";
import { destinationAfterLogin, safeNextPath, type Membership } from "./paths";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const member = (overrides: Partial<Membership> = {}): Membership => ({
  member_id: "m1",
  company_id: A,
  company_name: "회사A",
  name: "홍길동",
  role: "employee",
  status: "approved",
  ...overrides,
});

describe("safeNextPath", () => {
  it("같은 사이트 절대 경로만 허용한다", () => {
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("/auth/callback")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("destinationAfterLogin", () => {
  it("운영자 화면 경로는 로그인 뒤 그대로 (접근 확인은 그 화면에서)", () => {
    expect(destinationAfterLogin(member(), "/app-admin")).toBe("/app-admin");
    expect(destinationAfterLogin(null, "/app-admin/companies/x?month=2026-10")).toBe("/app-admin/companies/x?month=2026-10");
    expect(destinationAfterLogin(member(), "/app-adminx")).toBe(`/workspace/${A}/employee`);
  });

  it("소속이 없으면 온보딩(가입·생성 경로만 next 허용)", () => {
    expect(destinationAfterLogin(null, null)).toBe("/onboarding");
    expect(destinationAfterLogin(null, "/onboarding/join?code=ABCDEFGH")).toBe("/onboarding/join?code=ABCDEFGH");
    expect(destinationAfterLogin(null, `/workspace/${A}/employee`)).toBe("/onboarding");
  });

  it("승인 대기·비활성은 대기 화면으로", () => {
    expect(destinationAfterLogin(member({ status: "pending" }), `/workspace/${A}/employee`)).toBe("/onboarding/pending");
    expect(destinationAfterLogin(member({ status: "inactive" }), null)).toBe("/onboarding/pending");
  });

  it("역할별 워크스페이스로", () => {
    expect(destinationAfterLogin(member(), null)).toBe(`/workspace/${A}/employee`);
    expect(destinationAfterLogin(member({ role: "admin" }), null)).toBe(`/workspace/${A}/admin`);
    expect(destinationAfterLogin(member({ role: "super_admin" }), null)).toBe(`/workspace/${A}/admin`);
  });

  it("자기 회사 경로의 next만 따른다 (다른 회사 경로로는 보내지 않음)", () => {
    expect(destinationAfterLogin(member(), `/workspace/${A}/approvals/c1`)).toBe(`/workspace/${A}/approvals/c1`);
    expect(destinationAfterLogin(member(), `/workspace/${B}/approvals/c1`)).toBe(`/workspace/${A}/employee`);
  });

  it("직원은 관리자 경로 next를 따르지 않는다", () => {
    expect(destinationAfterLogin(member(), `/workspace/${A}/admin/settings`)).toBe(`/workspace/${A}/employee`);
    expect(destinationAfterLogin(member({ role: "admin" }), `/workspace/${A}/admin/settings`)).toBe(`/workspace/${A}/admin/settings`);
  });
});
