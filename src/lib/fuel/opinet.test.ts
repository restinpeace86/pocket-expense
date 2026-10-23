import { describe, expect, it, vi } from "vitest";
import { fetchOpinetAvgAll, parseOpinetAvgAll } from "./opinet";

const SAMPLE = {
  RESULT: {
    OIL: [
      { TRADE_DT: "20261022", PRODCD: "B034", PRODNM: "고급휘발유", PRICE: "1915.40", DIFF: "+0.10" },
      { TRADE_DT: "20261022", PRODCD: "B027", PRODNM: "휘발유", PRICE: "1680.12", DIFF: "-0.35" },
      { TRADE_DT: "20261022", PRODCD: "D047", PRODNM: "자동차용경유", PRICE: "1540.50", DIFF: "-0.20" },
      { TRADE_DT: "20261022", PRODCD: "C004", PRODNM: "실내등유", PRICE: "1300.00", DIFF: "0.00" },
      { TRADE_DT: "20261022", PRODCD: "K015", PRODNM: "자동차용부탄", PRICE: "1,010.00", DIFF: "0.00" },
    ],
  },
};

describe("오피넷 전국 평균 가격 (D-117)", () => {
  it("휘발유 B027·경유 D047·LPG K015만 뽑는다", () => {
    expect(parseOpinetAvgAll(SAMPLE)).toEqual({ ok: true, prices: { logDate: "2026-10-22", gasoline: 1680.12, diesel: 1540.5, lpg: 1010 } });
  });
  it("형식이 다르면 이유와 함께 실패", () => {
    expect(parseOpinetAvgAll({})).toMatchObject({ ok: false });
    expect(parseOpinetAvgAll({ RESULT: { OIL: [{ TRADE_DT: "x", PRODCD: "B027", PRICE: "1" }] } })).toMatchObject({ ok: false });
    expect(parseOpinetAvgAll({ RESULT: { OIL: [{ TRADE_DT: "20261022", PRODCD: "C004", PRICE: "1300" }] } })).toMatchObject({ ok: false });
  });
  it("호출 실패하면 한 번 더, 그래도 실패면 오류", async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockResolvedValueOnce(new Response("err", { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const p = fetchOpinetAvgAll("KEY", f as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await p).toMatchObject({ ok: true, prices: { gasoline: 1680.12 } });
    expect(f).toHaveBeenCalledTimes(2);
    const g = vi.fn().mockResolvedValue(new Response("<html>오류</html>", { status: 200 }));
    const q = fetchOpinetAvgAll("KEY", g as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await q).toMatchObject({ ok: false });
    vi.useRealTimers();
  });
});
