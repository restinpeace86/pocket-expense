import { describe, expect, it } from "vitest";
import { addRowBelow, anchorOf, baseName, cellAddress, convertErrorMessage, coverMap, deleteRow, docFromAi, draftDaysLeft, isConvertible, setCellText, sheetFromAi, validDoc, type Sheet } from "./model";

// 휴가신청서 모양: 1행 제목(4칸 합침), 2행 성명|값|부서|값, 3행 기간(라벨이 2행 세로 합침)|값(3칸)
const ai = {
  col_widths: [1, 2, 1, 2],
  rows: [
    { height: 2, cells: [{ text: "휴 가 신 청 서", col_span: 4, bold: true, align: "center" }] },
    { cells: [{ text: "성명", shaded: true }, { text: "김민지" }, { text: "부서", shaded: true }, { text: "경영지원팀" }] },
    { cells: [{ text: "기간", row_span: 2, shaded: true }, { text: "2026.11.20 ~ 11.21", col_span: 3 }] },
    { cells: [{ text: "(2일간)", col_span: 3, align: "right" }] },
  ],
};

describe("sheetFromAi", () => {
  const s = sheetFromAi(ai, "1쪽") as Sheet;
  it("HTML 표처럼 합친 칸을 격자로", () => {
    expect(s.cells.length).toBe(4);
    expect(s.cols.length).toBe(4);
    expect(s.cells[0][0]).toEqual({ t: "휴 가 신 청 서", b: true, al: "c" });
    expect(s.cells[3][1].t).toBe("(2일간)"); // 위에서 내려온 '기간' 자리를 건너뜀
    expect(s.cells[3][1].al).toBe("r");
    expect(s.merges).toEqual([
      { r: 0, c: 0, rs: 1, cs: 4 },
      { r: 2, c: 0, rs: 2, cs: 1 },
      { r: 2, c: 1, rs: 1, cs: 3 },
      { r: 3, c: 1, rs: 1, cs: 3 },
    ]);
    expect(s.heights[0]).toBe(2);
    expect(s.cols[1]).toBeGreaterThan(s.cols[0]);
  });
  it("빈 표·글자 없는 표는 없음", () => {
    expect(sheetFromAi({ rows: [] }, "x")).toBeNull();
    expect(sheetFromAi({ rows: [{ cells: [{ text: "" }] }] }, "x")).toBeNull();
    expect(docFromAi([{ rows: [] }])).toBeNull();
  });
  it("합친 칸 덮인 자리·주소", () => {
    const m = coverMap(s);
    expect(m.has("0:1")).toBe(true);
    expect(m.has("3:0")).toBe(true);
    expect(anchorOf(s, 3, 0)).toEqual({ r: 2, c: 0 });
    expect(cellAddress(4, 1)).toBe("B5");
    expect(cellAddress(0, 27)).toBe("AB1");
  });
  it("쪽마다 시트, 5쪽까지", () => {
    const d = docFromAi(Array.from({ length: 7 }, () => ai));
    expect(d?.sheets.length).toBe(5);
    expect(d?.sheets[1].name).toBe("2쪽");
    expect(validDoc(d)).toBe(true);
  });
});

describe("고치기", () => {
  const s = sheetFromAi(ai, "1쪽") as Sheet;
  it("글자", () => {
    const n = setCellText(s, 1, 1, "박주임");
    expect(n.cells[1][1].t).toBe("박주임");
    expect(s.cells[1][1].t).toBe("김민지"); // 원본은 그대로(되돌리기)
  });
  it("행 추가: 합친 칸 안이면 늘고, 아래면 밀림", () => {
    const n = addRowBelow(s, 2); // 기간(2~3행) 사이
    expect(n.cells.length).toBe(5);
    expect(n.merges).toContainEqual({ r: 2, c: 0, rs: 3, cs: 1 });
    expect(n.merges).toContainEqual({ r: 4, c: 1, rs: 1, cs: 3 });
    const end = addRowBelow(s, 3);
    expect(end.cells[4].every((c) => c.t === "")).toBe(true);
    expect(validDoc({ v: 1, sheets: [n] })).toBe(true);
  });
  it("행 삭제: 세로 합친 칸의 첫 행을 지우면 글자가 다음 행으로", () => {
    const n = deleteRow(s, 2);
    expect(n.cells.length).toBe(3);
    expect(n.cells[2][0].t).toBe("기간");
    expect(n.merges.find((g) => g.r === 2 && g.c === 0)).toBeUndefined(); // 한 행이 되어 합친 칸 아님
    expect(validDoc({ v: 1, sheets: [n] })).toBe(true);
    const one = { ...s, cells: [s.cells[0]], heights: [1], merges: [] };
    expect(deleteRow(one, 0)).toBe(one); // 마지막 한 행은 못 지움
  });
  it("모양이 틀리면 저장 안 함", () => {
    expect(validDoc({ v: 1, sheets: [{ ...s, heights: [1] }] })).toBe(false);
    expect(validDoc({ v: 1, sheets: [{ ...s, merges: [{ r: 3, c: 0, rs: 3, cs: 1 }] }] })).toBe(false);
    expect(validDoc({ v: 1, sheets: [] })).toBe(false);
  });
});

describe("기타", () => {
  it("변환 가능한 파일", () => {
    expect(isConvertible("application/pdf")).toBe(true);
    expect(isConvertible("image/heic")).toBe(false);
  });
  it("직원 안내에 크레딧 숫자 없음", () => {
    expect(convertErrorMessage("NO_CREDITS")).toBe("지금은 변환할 수 없어요. 관리자에게 문의해 주세요.");
    expect(convertErrorMessage("NO_CREDITS")).not.toMatch(/\d|크레딧/);
    expect(convertErrorMessage("CONVERT_LIMIT")).toBe("이번 달 서류 변환을 다 썼어요. 관리자에게 알려 주세요. 다음 달 1일에 다시 쓸 수 있어요.");
    expect(convertErrorMessage("CONVERT_LIMIT")).not.toMatch(/크레딧|\d+건/);
  });
  it("초안 남은 날·파일 이름", () => {
    const now = Date.parse("2026-11-11T00:00:00Z");
    expect(draftDaysLeft("2026-11-01T00:00:00Z", now)).toBe(20);
    expect(draftDaysLeft("2026-09-01T00:00:00Z", now)).toBe(0);
    expect(baseName("휴가신청서_양식.jpg")).toBe("휴가신청서_양식");
  });
});
