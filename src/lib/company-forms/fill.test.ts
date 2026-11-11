import { describe, expect, it } from "vitest";
import type { DocModel } from "@/lib/doc-convert/model";
import { dataValue, fillForm, leaveDocNumber, type LeaveDocData } from "./fill";
import type { Field } from "./model";

const doc: DocModel = {
  v: 1,
  sheets: [{ name: "1쪽", cols: [1, 1, 1, 1], heights: [1, 1, 1], cells: [[{ t: "성명" }, { t: "" }, { t: "담당" }, { t: "대표" }], [{ t: "기간" }, { t: "" }, { t: "" }, { t: "" }], [{ t: "대행자" }, { t: "" }, { t: "비고" }, { t: "x" }]], merges: [] }],
};
const fields: Field[] = [
  { key: "a", label: "성명", s: 0, r: 0, c: 1, b: { k: "data", src: "member.name" } },
  { key: "b", label: "기간", s: 0, r: 1, c: 1, b: { k: "data", src: "leave.period" } },
  { key: "c", label: "담당", s: 0, r: 1, c: 2, b: { k: "data", src: "approval.1" } },
  { key: "d", label: "대표", s: 0, r: 1, c: 3, b: { k: "data", src: "approval.2" } },
  { key: "e", label: "대행자", s: 0, r: 2, c: 1, b: { k: "input", type: "member", required: true } },
  { key: "f", label: "비고", s: 0, r: 2, c: 3, b: { k: "blank" } },
];
const data: LeaveDocData = {
  company: "예시 회사",
  member: { name: "김직원", department: "영업", position: "대리", employee_number: null },
  docDate: "2026-11-11",
  docNumber: "휴가-20261111-ABC123",
  leave: { type: "연차", start: "2026-11-14", end: "2026-11-15", unit: "day", startTime: null, hours: null, workdays: 2, reason: "개인 사정", remaining: 9.5, proof: false },
  applicant: { name: "김직원", position: "대리", date: "2026-11-11" },
  approver: { name: "박대표", position: "대표", date: "2026-11-12" },
  custom: { e: "이대리" },
};

describe("휴가신청서 채우기", () => {
  it("칸 바인딩대로 채우고 원본은 그대로", () => {
    const out = fillForm(doc, fields, data).sheets[0].cells;
    expect(out[0][1].t).toBe("김직원");
    expect(out[1][1].t).toBe("2026.11.14 ~ 2026.11.15");
    expect(out[1][2].t).toBe("김직원\n대리\n11.11");
    expect(out[1][3].t).toBe("박대표\n대표\n11.12");
    expect(out[2][1].t).toBe("이대리");
    expect(out[2][3].t).toBe("");
    expect(doc.sheets[0].cells[2][3].t).toBe("x");
  });
  it("승인 전·반려, 시간 단위, 남은 연차·문서 번호", () => {
    expect(dataValue("approval.2", { ...data, approver: "pending" })).toBe("결재 전");
    expect(dataValue("approval.2", { ...data, approver: "rejected" })).toBe("반려");
    const h = { ...data, leave: { ...data.leave, unit: "hour" as const, end: "2026-11-14", startTime: "14:00:00", hours: 2 } };
    expect(dataValue("leave.period", h)).toBe("2026.11.14 14:00부터 2시간");
    expect(dataValue("leave.days", h)).toBe("2시간");
    expect(dataValue("leave.half", h)).toBe("오후");
    expect(dataValue("leave.remaining", data)).toBe("9.5일");
    expect(leaveDocNumber("abcdef12-3456-7890-abcd-ef1234567890", "2026-11-11")).toBe("휴가-20261111-ABCDEF");
  });
});
