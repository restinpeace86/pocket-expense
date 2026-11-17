import { describe, expect, it } from "vitest";
import type { Sheet } from "@/lib/doc-convert/model";
import { cleanRows, detectTable, fillTable, tableTotal } from "./table";

// 구매요청서: 0행 제목, 1행 머리글(품목·규격·수량·단가·금액), 2~4행 빈 줄, 5행 합계, 6행 사유
const sheet = (): Sheet => ({
  name: "1쪽",
  cols: [10, 25, 15, 10, 20, 20],
  heights: [1, 1, 1, 1, 1, 1, 1],
  cells: [
    [{ t: "구매요청서" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }],
    [{ t: "번호" }, { t: "품목" }, { t: "규격" }, { t: "수량" }, { t: "단가" }, { t: "금액" }],
    [{ t: "1" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }],
    [{ t: "2" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }],
    [{ t: "3" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }],
    [{ t: "합계" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }],
    [{ t: "사유" }, { t: "재고 소진" }, { t: "" }, { t: "" }, { t: "" }, { t: "" }],
  ],
  merges: [{ r: 0, c: 0, rs: 1, cs: 6 }],
});

describe("표 칸(9-33e7)", () => {
  it("첫 빈 칸에서 머리글·열·빈 줄 수를 알아냄(합계 줄에서 멈춤)", () => {
    const t = detectTable(sheet(), 2, 1)!;
    expect(t.cols.map((k) => `${k.label}:${k.type}`)).toEqual(["품목:text", "규격:text", "수량:number", "단가:money", "금액:money"]);
    expect(t.rows).toBe(3);
  });
  it("글자가 있는 칸·머리글이 없으면 표가 아님", () => {
    expect(detectTable(sheet(), 6, 1)).toBeNull();
    expect(detectTable(sheet(), 0, 1)).toBeNull();
  });
  it("양식 줄 안이면 그대로 채우고, 넘치면 줄을 더 넣어 아래 칸은 밀림", () => {
    const t = detectTable(sheet(), 2, 1)!;
    const rows = [["A4", "80g", "10", "25000", "250000"], ["토너", "", "2", "89000", "178000"], ["", "", "", "", ""]];
    const a = fillTable(sheet(), 2, t.cols, t.rows, rows);
    expect(a.cells[2].slice(1).map((x) => x.t)).toEqual(["A4", "80g", "10", "25,000", "250,000"]);
    expect(a.cells.length).toBe(7);
    const many = Array.from({ length: 5 }, (_, i) => [`품목${i + 1}`, "", "1", "1000", "1000"]);
    const b = fillTable(sheet(), 2, t.cols, t.rows, many);
    expect(b.cells.length).toBe(9);
    expect(b.cells[6][1].t).toBe("품목5");
    expect(b.cells[7][0].t).toBe("합계"); // 밀려 내려감
    expect(b.cells[8][1].t).toBe("재고 소진");
  });
  it("빈 줄 빼기·마지막 금액 열 합계", () => {
    const t = detectTable(sheet(), 2, 1)!;
    const rows = [["A4", "", "10", "25000", "250000"], ["", "", "", "", ""], ["토너", "", "2", "89000", "178,000"]];
    expect(cleanRows(rows)).toHaveLength(2);
    expect(tableTotal(t.cols, rows)).toBe(428000);
  });
});

describe("AI 결과에서 표 자동(9-33e7)", () => {
  it("표 안에 값 칸이 3개 이상이면 표 칸 하나로", async () => {
    const { autoTables } = await import("./model");
    const sh = sheet();
    const fields = [
      { key: "f1", label: "품목", s: 0, r: 2, c: 1, b: { k: "input" as const, type: "text" as const, required: false } },
      { key: "f2", label: "수량", s: 0, r: 2, c: 3, b: { k: "input" as const, type: "number" as const, required: false } },
      { key: "f3", label: "금액", s: 0, r: 3, c: 5, b: { k: "pending" as const } },
      { key: "f4", label: "사유", s: 0, r: 6, c: 2, b: { k: "input" as const, type: "long" as const, required: true } },
    ];
    const out = autoTables([sh], fields);
    expect(out.map((f) => f.key).sort()).toEqual(["f1", "f4"]);
    const t = out.find((f) => f.key === "f1")!;
    expect(t.b.k === "input" && t.b.type === "table" && t.b.rows === 3 && t.b.cols?.length === 5).toBe(true);
  });
});

describe("양식 제목 띄움 정리", () => {
  it("낱글자 띄움만 붙이고 단어 띄어쓰기는 그대로", async () => {
    const { tidyTitle } = await import("./model");
    expect(tidyTitle("구 매 요 청 서")).toBe("구매요청서");
    expect(tidyTitle(" 휴  가 신 청 서 ")).toBe("휴가신청서");
    expect(tidyTitle("출장 신청서")).toBe("출장 신청서");
    expect(tidyTitle("품의서")).toBe("품의서");
  });
});
