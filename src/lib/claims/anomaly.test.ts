import { describe, expect, it } from "vitest";
import { anomalyFlags } from "./anomaly";

const base = { id: "x", expense_date: "2026-10-14", paid_time: "12:30:00", merchant_name: "김밥천국 강남점", amount: 9000 }; // 수요일 점심

describe("이상 거래 표시", () => {
  it("평범한 결제는 표시 없음", () => {
    expect(anomalyFlags(base, [], [])).toEqual([]);
  });
  it("심야(22~06시)", () => {
    expect(anomalyFlags({ ...base, paid_time: "23:10:00" }, [], [])).toEqual(["심야 결제(23:10)"]);
    expect(anomalyFlags({ ...base, paid_time: "05:59" }, [], [])).toEqual(["심야 결제(05:59)"]);
    expect(anomalyFlags({ ...base, paid_time: "06:00" }, [], [])).toEqual([]);
  });
  it("주말·공휴일", () => {
    expect(anomalyFlags({ ...base, expense_date: "2026-10-17" }, [], [])).toEqual(["주말 결제"]);
    expect(anomalyFlags({ ...base, expense_date: "2026-10-09" }, [], ["2026-10-09"])).toEqual(["공휴일 결제"]);
  });
  it("같은 날 같은 가맹점(띄어쓰기 무시)", () => {
    const peers = [{ id: "y", expense_date: "2026-10-14", merchant_name: "김밥천국강남점", amount: 9000 }];
    expect(anomalyFlags(base, peers, [])).toEqual(["같은 날 같은 가맹점 2건"]);
  });
  it("평소의 3배 이상 · 5만 원 이상(기록 5건 이상일 때만)", () => {
    const peers = [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, expense_date: `2026-09-0${n}`, merchant_name: "식당", amount: 10000 }));
    expect(anomalyFlags({ ...base, amount: 60000 }, peers, [])).toEqual(["평소의 6배 금액"]);
    expect(anomalyFlags({ ...base, amount: 29000 }, peers, [])).toEqual([]);
    expect(anomalyFlags({ ...base, amount: 60000 }, peers.slice(0, 4), [])).toEqual([]);
  });
});
