import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredSiteUrl, isLocalOrigin, publicOrigin } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("publicOrigin — 초대·공유 링크 앞주소", () => {
  it("로컬에서 만들면 배포 주소", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pocket-expense-ruby.vercel.app/");
    expect(publicOrigin("http://localhost:3000")).toBe("https://pocket-expense-ruby.vercel.app");
    expect(publicOrigin("http://127.0.0.1:3100")).toBe("https://pocket-expense-ruby.vercel.app");
    expect(publicOrigin("http://192.168.0.12:3000")).toBe("https://pocket-expense-ruby.vercel.app");
  });
  it("미리보기 배포에서 만들어도 운영 주소(카카오가 미등록 도메인을 localhost로 바꾸는 것 방지, D-113)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pocket-expense-ruby.vercel.app");
    expect(publicOrigin("https://pocket-expense-git-x.vercel.app")).toBe("https://pocket-expense-ruby.vercel.app");
    expect(publicOrigin("https://pocket-expense-ruby.vercel.app")).toBe("https://pocket-expense-ruby.vercel.app");
  });
  it("NEXT_PUBLIC_SITE_URL이 없으면 Vercel이 넣어 주는 운영 도메인(브라우저용 NEXT_PUBLIC_ 이름)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "pocket-expense-ruby.vercel.app");
    expect(publicOrigin("https://pocket-expense-git-x.vercel.app")).toBe("https://pocket-expense-ruby.vercel.app");
  });
  it("NEXT_PUBLIC_SITE_URL이 없으면 Vercel 운영 도메인, 그것도 없으면 지금 주소", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "pocket-expense-ruby.vercel.app");
    expect(configuredSiteUrl()).toBe("https://pocket-expense-ruby.vercel.app");
    expect(publicOrigin("http://localhost:3000")).toBe("https://pocket-expense-ruby.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(publicOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("로컬 판별", () => {
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("http://172.20.1.2")).toBe(true);
    expect(isLocalOrigin("http://172.40.1.2")).toBe(false);
    expect(isLocalOrigin("https://example.com")).toBe(false);
  });
});
