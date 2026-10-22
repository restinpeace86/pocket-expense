import { describe, expect, it } from "vitest";
import { reconcile, type LedgerItem } from "./reconcile";
import { detectColumns, parseAmount, parseDate, toRows } from "./statement";

describe("카드사 내역 읽기 (D-111)", () => {
  const table = [
    ["법인카드 이용내역", null],
    ["조회기간 2026.10.01 ~ 2026.10.31"],
    ["이용일자", "이용카드", "이용가맹점", "이용금액", "할부개월", "결제예정금액", "승인구분"],
    ["2026.10.14", "5327-12**-****-7890", "스타벅스 강남점", "12,000", "일시불", "12,000", "승인"],
    ["2026.10.15", "5327-12**-****-7890", "한국도로공사", "18,000", "", "18,000", "승인"],
    ["2026.10.15", "5327-12**-****-7890", "한국도로공사", "-18,000", "", "-18,000", "취소"],
    ["2026.10.20", "9430-11**-****-1234", "노션", "48,000", "", "48,000", "승인"],
    ["합계", "", "", "60,000", "", "", ""],
  ];
  it("머리글·열을 찾는다(할부·결제예정금액은 금액 열로 안 씀)", () => {
    const d = detectColumns(table)!;
    expect(d.headerRow).toBe(2);
    expect(d.map).toEqual({ date: 0, card: 1, merchant: 2, amount: 3, status: 6 });
  });
  it("행: 합계 줄은 건너뛰고, 음수·취소는 취소로", () => {
    const d = detectColumns(table)!;
    const { rows, skipped } = toRows(table, d.headerRow, d.map, 2026);
    expect(skipped).toBe(1);
    expect(rows.map((r) => [r.date, r.amount, r.last4, r.cancelled])).toEqual([
      ["2026-10-14", 12000, "7890", false],
      ["2026-10-15", 18000, "7890", false],
      ["2026-10-15", 18000, "7890", true],
      ["2026-10-20", 48000, "1234", false],
    ]);
  });
  it("날짜·금액 여러 모양", () => {
    expect(parseDate("20261014", 2026)).toBe("2026-10-14");
    expect(parseDate("2026-10-14 13:20", 2026)).toBe("2026-10-14");
    expect(parseDate("26.10.14", 2026)).toBe("2026-10-14");
    expect(parseDate("10/14", 2026)).toBe("2026-10-14");
    expect(parseDate(46309, 2026)).toBe("2026-10-14"); // 엑셀 일련번호
    expect(parseDate(new Date("2026-10-13T15:00:00Z"), 2026)).toBe("2026-10-14"); // KST 자정
    expect(parseAmount("₩12,000")).toBe(12000);
    expect(parseAmount("(5,000)")).toBe(-5000);
    expect(parseAmount("합계")).toBeNull();
  });
});

describe("영수증과 짝 맞추기 (D-111)", () => {
  const item = (p: Partial<LedgerItem>): LedgerItem => ({ id: "i", claimId: "c", claimTitle: "t", claimStatus: "submitted", memberName: "김", date: "2026-10-14", amount: 12000, merchant: "스타벅스", paymentMethod: "corporate_card", last4: "7890", ...p });
  const row = (p: Partial<{ date: string; amount: number; last4: string | null; merchant: string; cancelled: boolean }>) => ({ line: 1, date: "2026-10-14", merchant: "스타벅스 강남점", amount: 12000, last4: "7890", cancelled: false, ...p });
  it("같은 금액·날짜 ±1일·같은 카드면 짝, 다른 카드면 아님", () => {
    const r = reconcile([row({}), row({ date: "2026-10-16", amount: 30000 })], [item({ id: "a", date: "2026-10-15" }), item({ id: "b", amount: 30000, date: "2026-10-16", last4: "1111" })]);
    expect(r.matched.map((m) => m.item.id)).toEqual(["a"]);
    expect(r.missing.map((m) => m.amount)).toEqual([30000]);
    expect(r.extra.map((e) => e.id)).toEqual([]); // 1111 카드는 내역에 없는 카드
  });
  it("개인(사비)으로 올린 법인카드 결제는 따로", () => {
    const r = reconcile([row({})], [item({ id: "p", paymentMethod: "personal_card", last4: null })]);
    expect(r.personal.map((m) => m.item.id)).toEqual(["p"]);
  });
  it("한 영수증은 한 결제에만, 취소는 세기만, 내역 기간 안 법인카드 영수증 중 짝 없는 것", () => {
    const r = reconcile(
      [row({}), row({}), row({ cancelled: true })],
      [item({ id: "a" }), item({ id: "z", amount: 5000, date: "2026-10-14" }), item({ id: "out", amount: 5000, date: "2026-11-01" })],
    );
    expect(r.matched.length).toBe(1);
    expect(r.missing.length).toBe(1);
    expect(r.cancelled).toBe(1);
    expect(r.extra.map((e) => e.id)).toEqual(["z"]);
  });
});

describe("CSV 읽기", () => {
  it("따옴표 안 쉼표·줄바꿈, 탭 구분", async () => {
    const { parseCsv } = await import("./read-statement");
    expect(parseCsv('이용일자,가맹점,이용금액\r\n2026-10-14,"스타벅스, 강남점","12,000"\r\n')).toEqual([
      ["이용일자", "가맹점", "이용금액"],
      ["2026-10-14", "스타벅스, 강남점", "12,000"],
    ]);
    expect(parseCsv("이용일자\t이용금액\n2026-10-14\t12000")).toEqual([
      ["이용일자", "이용금액"],
      ["2026-10-14", "12000"],
    ]);
  });
});
