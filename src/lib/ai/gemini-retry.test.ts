import { describe, expect, it, vi } from "vitest";
import { tryGemini } from "./gemini-retry";

describe("Gemini 다시 부르기(2026-11-18)", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  it("바쁨(503)이면 같은 모델로 한 번 더 → 성공", async () => {
    let n = 0;
    const r = await tryGemini(["a", "b"], async (m) => {
      n++;
      if (n === 1) throw new Error("gemini 503");
      return m;
    }, "t", { delayMs: 1 });
    expect(r).toEqual({ ok: true, value: "a" });
    expect(n).toBe(2);
  });
  it("두 모델 다 바쁨 → busy", async () => {
    const r = await tryGemini(["a", "b"], async () => {
      throw new Error("gemini 503");
    }, "t", { delayMs: 1 });
    expect(r).toEqual({ ok: false, busy: true });
  });
  it("응답 깨짐(바쁨 아님)은 같은 모델 다시 안 하고 다음 모델", async () => {
    const seen: string[] = [];
    const r = await tryGemini(["a", "b"], async (m) => {
      seen.push(m);
      if (m === "a") throw new SyntaxError("Unexpected token");
      return "ok";
    }, "t", { delayMs: 1 });
    expect(seen).toEqual(["a", "b"]);
    expect(r).toEqual({ ok: true, value: "ok" });
  });
});
