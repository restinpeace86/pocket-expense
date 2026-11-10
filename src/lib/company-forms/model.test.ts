import { describe, expect, it } from "vitest";
import type { DocModel } from "@/lib/doc-convert/model";
import { applyDrops, cellHint, formErrorMessage, formFromAi, inputCount, isDataKey, pendingCount, shiftFieldsAddRow, shiftFieldsDeleteRow, validFields, type AiFormPage, type Field } from "./model";

// 휴가신청서: 1행 제목 / 2행 성명|값|소속|값 / 3행 업무 대행자|값(3칸) / 4행 결재 담당|값
const page: AiFormPage = {
  title: "휴 가 신 청 서",
  col_widths: [1, 2, 1, 2],
  rows: [
    { cells: [{ text: "휴 가 신 청 서", col_span: 4, bold: true }] },
    { cells: [{ text: "성 명" }, { text: "", slot_label: "성명", slot_data: "member.name" }, { text: "소속" }, { text: "", slot_label: "소속", slot_data: "member.department" }] },
    { cells: [{ text: "업무 대행자:" }, { text: "", col_span: 3, slot_label: "업무 대행자", slot_data: "none" }] },
    { cells: [{ text: "결재" }, { text: "", slot_label: "담당", slot_data: "approval.1" }, { text: "" }, { text: "", slot_label: "중복", slot_data: "member.name" }] },
  ],
};

describe("formFromAi", () => {
  const read = formFromAi([page], "leave")!;
  it("표 + 값 칸, 우리 데이터 짝짓기, 없으면 정해 주세요", () => {
    expect(read.title).toBe("휴 가 신 청 서");
    expect(read.doc.sheets[0].cells.length).toBe(4);
    const byLabel = Object.fromEntries(read.fields.map((f) => [f.label, f]));
    expect(byLabel["성명"]).toMatchObject({ r: 1, c: 1, lr: 1, lc: 0, b: { k: "data", src: "member.name" } });
    expect(byLabel["업무 대행자"].b).toEqual({ k: "pending" });
    expect(byLabel["담당"].b).toEqual({ k: "data", src: "approval.1" });
  });
  it("같은 데이터가 두 칸이면 두 번째는 정해 주세요", () => {
    expect(read.fields.find((f) => f.label === "중복")!.b).toEqual({ k: "pending" });
    expect(pendingCount(read.fields)).toBe(2);
  });
  it("휴가 데이터는 일반 결재 문서에서 쓸 수 없음", () => {
    expect(isDataKey("leave.period", "leave")).toBe(true);
    expect(isDataKey("leave.period", "general")).toBe(false);
    expect(isDataKey("member.name", "general")).toBe(true);
  });
  it("표가 없으면 null", () => {
    expect(formFromAi([{ col_widths: [], rows: [] }], "leave")).toBeNull();
  });
});

const doc: DocModel = {
  v: 1,
  sheets: [{ name: "1쪽", cols: [50, 50], heights: [1, 1, 1], cells: [[{ t: "성명" }, { t: "" }], [{ t: "대행자" }, { t: "" }], [{ t: "비고" }, { t: "" }]], merges: [] }],
};
const fields: Field[] = [
  { key: "f1", label: "성명", s: 0, r: 0, c: 1, lr: 0, lc: 0, b: { k: "data", src: "member.name" } },
  { key: "f2", label: "대행자", s: 0, r: 1, c: 1, lr: 1, lc: 0, b: { k: "drop" } },
  { key: "f3", label: "비고", s: 0, r: 2, c: 1, lr: 2, lc: 0, b: { k: "input", type: "text", required: false } },
];

describe("레이아웃 고칠 때 칸 따라가기", () => {
  it("행 추가: 아래 칸만 한 행 내려감", () => {
    const out = shiftFieldsAddRow(fields, 0, 0);
    expect(out.map((f) => f.r)).toEqual([0, 2, 3]);
    expect(out.map((f) => f.lr)).toEqual([0, 2, 3]);
  });
  it("행 삭제: 그 행 칸은 빠지고 아래는 올라감", () => {
    const out = shiftFieldsDeleteRow(fields, 0, 1, () => false);
    expect(out.map((f) => f.key)).toEqual(["f1", "f3"]);
    expect(out[1]).toMatchObject({ r: 1, lr: 1 });
  });
  it("행 삭제: 여러 행 합친 칸이면 남김", () => {
    expect(shiftFieldsDeleteRow(fields, 0, 1, (f) => f.key === "f2").map((f) => f.key)).toEqual(["f1", "f2", "f3"]);
  });
});

describe("등록할 때", () => {
  it("빼기 칸은 값·라벨 글자를 지우고 목록에서 뺀다", () => {
    const out = applyDrops(doc, fields);
    expect(out.fields.map((f) => f.key)).toEqual(["f1", "f3"]);
    expect(out.doc.sheets[0].cells[1][0].t).toBe("");
    expect(doc.sheets[0].cells[1][0].t).toBe("대행자"); // 원본은 그대로
  });
  it("직원 입력 칸 수", () => {
    expect(inputCount(fields)).toBe(1);
  });
  it("칸 모양 확인", () => {
    expect(validFields(fields, doc, "leave")).toBe(true);
    expect(validFields([{ ...fields[0], r: 9 }], doc, "leave")).toBe(false); // 표 밖
    expect(validFields([fields[0], { ...fields[0] }], doc, "leave")).toBe(false); // 같은 key
    expect(validFields([{ ...fields[0], b: { k: "data", src: "leave.reason" } }], doc, "general")).toBe(false);
    expect(validFields([{ ...fields[2], b: { k: "input", type: "choice", required: true, options: ["오전"] } }], doc, "leave")).toBe(false); // 선택지 2개부터
    expect(validFields([{ ...fields[2], b: { k: "input", type: "choice", required: true, options: ["오전", "오후"] } }], doc, "leave")).toBe(true);
  });
  it("칸 안 표시·오류 문구", () => {
    expect(cellHint({ k: "data", src: "member.name" }, "성명")).toBe("{신청자 이름}");
    expect(cellHint({ k: "blank" }, "x")).toBe("(수기)");
    expect(formErrorMessage("SLOTS_FULL")).toContain("추가 결제");
    expect(formErrorMessage("FIELDS_PENDING")).toContain("정해 주세요");
  });
});
