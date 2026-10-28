import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { hometaxZipNames } from "./kinds";
import { findHeaderRow, readHometaxTable } from "./parse";

function xlsxBytes(rows: unknown[][], bookType: "xlsx" | "xls" = "xlsx"): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "매입");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType }));
}

const rows = [
  ["전자세금계산서 매입 목록"],
  ["조회기간: 2026-09-01 ~ 2026-09-30"],
  ["작성일자", "승인번호", "공급자사업자등록번호", "상호", "공급가액", "세액", "합계금액"],
  ["2026-09-01", "20260901-1", "1234567890", "철물점", 10000, 1000, 11000],
  ["2026-09-15", "20260915-2", "2345678901", "문구점", 20000, 2000, 22000],
];

describe("readHometaxTable", () => {
  it("xlsx: 제목 줄을 건너뛰고 머리글을 찾는다", () => {
    const t = readHometaxTable(xlsxBytes(rows), "a.xlsx")!;
    expect(t.header[0]).toBe("작성일자");
    expect(t.rowCount).toBe(2);
    expect(t.preview[1][3]).toBe("문구점");
  });
  it("예전 .xls도 읽는다", () => {
    const t = readHometaxTable(xlsxBytes(rows, "xls"), "a.xls")!;
    expect(t.header).toContain("공급가액");
    expect(t.rowCount).toBe(2);
  });
  it("CSV: UTF-8(BOM)과 EUC-KR", () => {
    const csv = "거래일자,가맹점명,금액\n2026-09-02,김밥집,8000\n";
    const utf = new TextEncoder().encode("\uFEFF" + csv);
    expect(readHometaxTable(utf, "b.csv")!.header).toEqual(["거래일자", "가맹점명", "금액"]);
    // "거래일자,금액" + "1,2" 두 줄의 EUC-KR 바이트
    const euc = new Uint8Array([0xb0, 0xc5, 0xb7, 0xa1, 0xc0, 0xcf, 0xc0, 0xda, 0x2c, 0xb1, 0xdd, 0xbe, 0xd7, 0x0a, 0x31, 0x2c, 0x32, 0x0a]);
    const t = readHometaxTable(euc, "c.csv")!;
    expect(t.header).toEqual(["거래일자", "금액"]);
    expect(t.rowCount).toBe(1);
  });
  it("읽을 수 없는 파일은 null", () => {
    expect(readHometaxTable(new Uint8Array([1, 2, 3]), "x.xlsx")).toBeNull();
  });
  it("미리보기는 30줄까지", () => {
    const many = [["일자", "금액"], ...Array.from({ length: 50 }, (_, i) => [`2026-09-${(i % 28) + 1}`, i])];
    const t = readHometaxTable(xlsxBytes(many), "m.xlsx")!;
    expect(t.preview).toHaveLength(30);
    expect(t.rowCount).toBe(50);
  });
});

describe("findHeaderRow", () => {
  it("숫자 줄보다 글자 줄", () => {
    expect(findHeaderRow([["1", "2", "3"], ["일자", "상호", "금액"], ["2026", "가", "3"]])).toBe(1);
  });
});

describe("hometaxZipNames", () => {
  it("종류를 앞에 붙이고 같은 이름은 번호", () => {
    const m = hometaxZipNames([
      { id: "a", kind: "tax_invoice", file_name: "목록.xlsx" },
      { id: "b", kind: "tax_invoice", file_name: "목록.xlsx" },
      { id: "c", kind: "cash_receipt", file_name: "a/b.csv" },
    ]);
    expect(m.get("a")).toBe("전자세금계산서매입_목록.xlsx");
    expect(m.get("b")).toBe("전자세금계산서매입_목록_2.xlsx");
    expect(m.get("c")).toBe("현금영수증매입_a_b.csv");
  });
});
