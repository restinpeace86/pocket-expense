import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/push/actions", () => ({ saveAppTokenAction: vi.fn(), deleteAppTokenAction: vi.fn() }));

describe("설치 앱 로그인 돌아오기 (D-230)", () => {
  it("앱 주소(kr.damounlab.app://auth/callback?…) → 우리 /auth/callback?…", async () => {
    const { appUrlToCallback, APP_AUTH_CALLBACK } = await import("./native");
    expect(appUrlToCallback(`${APP_AUTH_CALLBACK}?next=%2Fworkspace&code=abc`)).toBe("/auth/callback?next=%2Fworkspace&code=abc");
    expect(appUrlToCallback(APP_AUTH_CALLBACK)).toBe("/auth/callback");
    expect(appUrlToCallback("kr.damounlab.app://auth/callbackX?code=1")).toBeNull();
    expect(appUrlToCallback("https://evil.example/auth/callback?code=1")).toBeNull();
  });
  it("브라우저에서는 앱 주소를 쓰지 않음", async () => {
    const { appAuthRedirect } = await import("./native");
    expect(appAuthRedirect("/x")).toBeNull();
  });
});
