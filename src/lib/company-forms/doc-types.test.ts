import { describe, expect, it } from "vitest";
import { ALL_STD_KEYS, docTypeLabel, guessDocType, guessInputType, isDocType, stdField } from "./doc-types";
import { formFromAi, type AiFormPage } from "./model";

describe("결재 문서 종류·표준 칸(9-33d)", () => {
  it("제목으로 종류 짐작, 모르면 기타", () => {
    expect(guessDocType("품 의 서")).toBe("pumui");
    expect(guessDocType("물품 구매 요청서")).toBe("purchase");
    expect(guessDocType("경위서")).toBe("incident");
    expect(guessDocType("업무 협조전")).toBe("other");
    expect(docTypeLabel("trip")).toBe("출장신청서");
    expect(isDocType("zz")).toBe(false);
  });
  it("짝 없는 칸 입력 방식 짐작", () => {
    expect(guessInputType("품의 금액")).toBe("money");
    expect(guessInputType("집행 기간")).toBe("period");
    expect(guessInputType("시행 일자")).toBe("date");
    expect(guessInputType("수량")).toBe("number");
    expect(guessInputType("세부 내용")).toBe("long");
    expect(guessInputType("프로젝트명")).toBe("text");
  });
  it("표준 칸 키는 종류.칸, 종류 밖 칸은 없음", () => {
    expect(ALL_STD_KEYS).toContain("pumui.amount");
    expect(stdField("pumui", "amount")?.type).toBe("money");
    expect(stdField("pumui", "place")).toBeNull();
  });
});

describe("AI 결과 → 결재 문서 칸", () => {
  const cell = (text: string, slot?: [string, string]) => ({ text, ...(slot ? { slot_label: slot[0], slot_data: slot[1] } : {}) });
  const page: AiFormPage = {
    title: "품 의 서",
    doc_type: "pumui",
    col_widths: [1, 1],
    rows: [
      { cells: [cell("성명"), cell("", ["성명", "member.name"])] },
      { cells: [cell("품의 금액"), cell("", ["품의 금액", "pumui.amount"])] },
      { cells: [cell("출장지"), cell("", ["출장지", "trip.place"])] },
      { cells: [cell("프로젝트명"), cell("", ["프로젝트명", "none"])] },
      { cells: [cell("합계 금액"), cell("", ["합계 금액", "pumui.amount"])] },
      { cells: [cell("담당", ["담당", "none"]), cell("대표")] },
    ],
  };
  it("종류의 표준 칸 → 우리 표준 칸, 다른 종류·짝 없음 → 직원 입력(방식 짐작), 같은 표준 칸 두 번째는 정해 주세요", () => {
    const r = formFromAi([page], "general")!;
    expect(r.docType).toBe("pumui");
    const by = Object.fromEntries(r.fields.map((f) => [f.label, f.b]));
    expect(by["성명"]).toEqual({ k: "data", src: "member.name" });
    expect(by["품의 금액"]).toEqual({ k: "input", type: "money", required: false, std: "amount" });
    expect(by["출장지"]).toEqual({ k: "input", type: "text", required: false });
    expect(by["프로젝트명"]).toEqual({ k: "input", type: "text", required: false });
    expect(by["합계 금액"]).toEqual({ k: "pending" });
    expect(by["담당"]).toEqual({ k: "pending" }); // 글자 있는 칸은 직원 입력으로 짐작 안 함
  });
  it("AI가 종류를 못 고르면 제목으로, 근태 양식은 종류 없음·짝 없는 칸은 정해 주세요", () => {
    expect(formFromAi([{ ...page, doc_type: null, title: "구 매 요 청 서" }], "general")!.docType).toBe("purchase");
    const leave = formFromAi([page], "leave")!;
    expect(leave.docType).toBeNull();
    expect(leave.fields.find((f) => f.label === "프로젝트명")?.b).toEqual({ k: "pending" });
  });
});
