import { describe, expect, it } from "vitest";
import { checks, issueKinds, rowHasFile, type ExportRow } from "./export-rows";
import { SAMPLE_EXPORT_ROWS } from "./sample-rows";

// 영수증 문제 칩(D-195): checks()와 같은 규칙
const base = SAMPLE_EXPORT_ROWS[0];
const row = (o: Partial<ExportRow>): ExportRow => ({ ...base, ...o });

describe("영수증 문제 종류 (D-195)", () => {
  it("문제 없는 영수증은 빈 목록", () => {
    expect(issueKinds(base, rowHasFile(base))).toEqual([]);
  });
  it("사업자번호·부가세·파일 없음", () => {
    const r = row({ merchant_business_number: null, supply_amount: null, vat_amount: null, receipt_path: null });
    expect(issueKinds(r, rowHasFile(r))).toEqual(["no_biz", "no_vat", "no_file"]);
  });
  it("회사 확인 요청(처리 전)이 맨 앞, 처리되면 빠짐", () => {
    expect(issueKinds(row({ tax_review_request: "회의비 맞나요?" }), true)[0]).toBe("review");
    expect(issueKinds(row({ tax_review_request: "회의비 맞나요?", tax_review_resolved_at: "2026-10-30T00:00:00Z" }), true)).toEqual([]);
  });
  it("카드 내역으로 증빙 대체는 파일 없음으로 세지 않음", () => {
    const r = row({ receipt_path: null, evidence_substitute: { source: "card", date: "2026-10-07", merchant: "x", amount: 1, last4: "1234" } });
    expect(issueKinds(r, false)).not.toContain("no_file");
  });
  it("checks()에 문제가 있으면 issueKinds도 있다(같은 규칙)", () => {
    for (const r of [base, row({ merchant_business_number: null }), row({ receipt_path: null }), row({ supply_amount: null })]) {
      expect(issueKinds(r, rowHasFile(r)).length > 0).toBe(checks(r, rowHasFile(r)).length > 0);
    }
  });
});
