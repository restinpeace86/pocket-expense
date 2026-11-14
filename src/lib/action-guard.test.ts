import { afterEach, describe, expect, it, vi } from "vitest";
import { guardAction, guarded, guardedForm, isNetworkFailure, OFFLINE_MESSAGE, UNREACHABLE_MESSAGE } from "./action-guard";

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

describe("isNetworkFailure", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("기기가 오프라인이면 무슨 오류든 끊김", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isNetworkFailure({ message: "permission denied" })).toBe(true);
  });
  it("온라인이어도 fetch 실패 문구면 끊김", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isNetworkFailure({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkFailure({ message: "Load failed" })).toBe(true);
  });
  it("서버가 거절한 오류(권한·없음)는 끊김이 아니다", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isNetworkFailure({ message: "NOT_MEMBER" })).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});

describe("guarded", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("인자를 그대로 넘기고 결과를 그대로 돌려준다", async () => {
    const f = guarded(async (a: number, b: string) => ({ ok: true as const, v: `${a}${b}` }));
    expect(await f(1, "x")).toEqual({ ok: true, v: "1x" });
  });
  it("던지면 실패 결과로 바꾼다(화면 전체 오류 대신)", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const f = guarded(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await f()).toEqual({ ok: false, error: OFFLINE_MESSAGE });
  });
});

describe("guardedForm", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("실패하면 안내 + 친 값을 돌려준다(칸이 비지 않게)", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const f = guardedForm(async (): Promise<{ error: string | null; values?: Record<string, string> }> => {
      throw new TypeError("Failed to fetch");
    });
    const fd = new FormData();
    fd.set("companyName", "예시 회사");
    fd.set("$ACTION_ID_x", "");
    expect(await f({ error: null }, fd)).toEqual({ error: OFFLINE_MESSAGE, values: { companyName: "예시 회사" } });
  });
  it("화면 이동 신호는 그대로 던진다", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
    const f = guardedForm(async (): Promise<{ error: string | null }> => Promise.reject(redirect));
    await expect(f({ error: null }, new FormData())).rejects.toBe(redirect);
  });
});
