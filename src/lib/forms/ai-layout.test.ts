import { describe, expect, it } from "vitest";
import { layoutFromAi } from "./ai-layout";

describe("AI가 읽은 종이 양식 → 양식 틀 (D-118)", () => {
  it("우리 데이터와 짝지은 칸만 남기고, 채울 수 없는 칸·결재란은 안내", () => {
    const r = layoutFromAi({
      title: "지 출 결 의 서",
      approval_labels: ["담당", "이사", "대표"],
      header_fields: [
        { label: "문서번호", binding: "doc.number" },
        { label: "지출건명", binding: "claim.title" },
        { label: "작성부서", binding: "member.department" },
        { label: "보존기간", binding: "none" },
        { label: "작성자", binding: "member.name" },
        { label: "담당자", binding: "member.name" },
      ],
      table_columns: [
        { label: "번호", binding: "item.no" },
        { label: "적요", binding: "item.line_name" },
        { label: "수량", binding: "item.quantity" },
        { label: "단가", binding: "item.unit_price" },
        { label: "결재코드", binding: "none" },
        { label: "금액", binding: "item.amount" },
        { label: "비고", binding: "item.note" },
      ],
      footer_fields: [{ label: "특이사항", binding: "claim.description" }, { label: "지출건명", binding: "claim.title" }],
      statement: "위와 같은 금액을 청구하오니, 결재하여 주시기 바랍니다. 0000 년 00 월 00 일",
      has_date: true,
      signer_label: "작성자:_______________(인)",
      has_company_line: false,
    });
    expect(r.layout.title).toBe("지 출 결 의 서");
    expect(r.layout.base).toBe("custom");
    expect(r.layout.header.map((h) => h.label)).toEqual(["문서번호", "지출건명", "작성부서", "보존기간", "작성자", "담당자"]);
    expect(r.layout.header.filter((h) => "pending" in h).map((h) => h.label)).toEqual(["보존기간", "담당자"]);
    expect(r.layout.columns.map((c) => (c.key.startsWith("custom.") ? "custom" : c.key))).toEqual(["item.no", "item.line_name", "item.quantity", "item.unit_price", "custom", "item.amount", "item.note"]);
    expect(r.layout.footer.map((f) => f.label)).toEqual(["특이사항", "지출건명"]); // 같은 데이터 중복 칸도 관리자가 정한다
    expect(r.pending).toEqual(["보존기간", "담당자", "결재코드", "지출건명"]);
    expect(r.approvalLabels).toEqual(["담당", "이사", "대표"]);
    expect(r.layout.statement).toBe("위와 같은 금액을 청구하오니, 결재하여 주시기 바랍니다.");
    expect(r.layout.signerLabel).toBe("작성자");
    expect(r.layout.showDate).toBe(true);
    expect(r.tableFallback).toBe(false);
  });

  it("표 칸을 못 맞추면 기본 표를 넣고 알린다, 이상한 값은 무시", () => {
    const r = layoutFromAi({ title: null, header_fields: [{ label: "x", binding: "drop table" }], table_columns: [{ label: "수량", binding: "none" }] });
    expect(r.tableFallback).toBe(true);
    expect(r.layout.columns.filter((c) => !c.key.startsWith("custom.")).length).toBeGreaterThan(0);
    expect(r.layout.title).toBe("지출결의서");
    expect(r.pending).toEqual(["x", "수량"]);
  });
});
