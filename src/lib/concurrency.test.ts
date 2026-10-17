import { describe, expect, it } from "vitest";
import { runPool } from "./concurrency";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("runPool", () => {
  it("동시에 limit건까지만 실행하고 순서대로 결과를 돌려준다", async () => {
    let running = 0;
    let peak = 0;
    const results = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await sleep(5);
      running--;
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it("실패하면 retries만큼 다시 시도하고, 그래도 실패하면 그 건만 실패로 남긴다", async () => {
    const attempts = new Map<string, number>();
    const results = await runPool(
      ["ok", "flaky", "bad"],
      2,
      async (name) => {
        const n = (attempts.get(name) ?? 0) + 1;
        attempts.set(name, n);
        if (name === "flaky" && n === 1) throw new Error("일시 오류");
        if (name === "bad") throw new Error("계속 오류");
        return name;
      },
      { retries: 1 },
    );
    expect(results[0]).toEqual({ ok: true, value: "ok" });
    expect(results[1]).toEqual({ ok: true, value: "flaky" });
    expect(results[2].ok).toBe(false);
    expect(attempts.get("bad")).toBe(2);
  });

  it("끝날 때마다 알려 준다 (진행률 표시용)", async () => {
    const settled: number[] = [];
    await runPool([1, 2, 3], 3, async (n) => n, { onSettled: (i) => settled.push(i) });
    expect(settled.sort()).toEqual([0, 1, 2]);
  });

  it("빈 목록은 바로 끝난다", async () => {
    expect(await runPool([], 3, async () => 1)).toEqual([]);
  });
});
