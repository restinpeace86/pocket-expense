import { afterEach, describe, expect, it, vi } from "vitest";
import { guardAction, OFFLINE_MESSAGE, UNREACHABLE_MESSAGE } from "./action-guard";

describe("guardAction", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("정상 결과는 그대로 돌려준다", async () => {
    expect(await guardAction(async () => ({ ok: true as const, n: 1 }))).toEqual({ ok: true, n: 1 });
  });

  it("인터넷이 끊겨 실패하면 연결 확인 안내로 바꾼다", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(await guardAction(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, error: OFFLINE_MESSAGE });
  });

  it("연결은 됐는데 응답이 이상하면(로그인 만료 등) 다시 시도 안내로 바꾼다", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(await guardAction(() => Promise.reject(new Error("An unexpected response was received from the server.")))).toEqual({ ok: false, error: UNREACHABLE_MESSAGE });
  });

  it("화면 이동(redirect·notFound) 신호는 Next가 처리하도록 그대로 던진다", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await expect(guardAction(() => Promise.reject(redirect))).rejects.toBe(redirect);
  });
});
