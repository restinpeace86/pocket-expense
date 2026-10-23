import { describe, expect, it } from "vitest";
import { amountInWords, buildDocModel, DEFAULT_LAYOUT, normalizeLayout, PRESETS, PRESET_IDS, SAMPLE_DOC } from "./layout";

describe("지출결의서 양식 틀 (D-118)", () => {
  it("금액 한글(수표식)", () => {
    expect(amountInWords(17800)).toBe("일만칠천팔백");
    expect(amountInWords(10_000_000)).toBe("일천만");
    expect(amountInWords(103300)).toBe("일십만삼천삼백");
    expect(amountInWords(120_005_010)).toBe("일억이천만오천일십");
    expect(amountInWords(0)).toBe("영");
  });

  it("기본 포맷 5종은 모두 검사를 그대로 통과한다", () => {
    for (const id of PRESET_IDS) expect(normalizeLayout(PRESETS[id].layout)).toEqual(PRESETS[id].layout);
  });

  it("저장값 검사: 모르는 칸·중복은 빼고, 표가 없으면 기본 양식", () => {
    const l = normalizeLayout({
      base: "custom",
      title: "  우리   회사  결의서 ",
      header: [{ key: "member.name", label: "성명" }, { key: "member.name", label: "중복" }, { key: "bank.secret", label: "x" }, { key: "claim.title" }],
      columns: [{ key: "item.amount", label: "금액" }, { key: "item.qty", label: "수량" }],
      footer: "x",
      statement: "",
    });
    expect(l.title).toBe("우리 회사 결의서");
    expect(l.header).toEqual([
      { key: "member.name", label: "성명" },
      { key: "claim.title", label: "제목" },
    ]);
    expect(l.columns).toEqual([{ key: "item.amount", label: "금액" }]);
    expect(l.footer).toEqual([]);
    expect(l.statement).toBeNull();
    expect(normalizeLayout({ columns: [] })).toBe(DEFAULT_LAYOUT);
    expect(normalizeLayout(null)).toBe(DEFAULT_LAYOUT);
  });

  it("문서 모델: 합계는 표 항목을 더해서, 금액 한글·기간·맺음말", () => {
    const m = buildDocModel(PRESETS.single.layout, SAMPLE_DOC, { companyName: "가나다" });
    expect(m.header.find((h) => h.label === "금 액")?.value).toBe("일금 일십만삼천삼백원정 (₩103,300)");
    expect(m.header.find((h) => h.label === "지출일자")?.value).toBe("2026-10-14 ~ 2026-10-17");
    expect(m.table.total).toEqual(["합계", "", "", "103,300"]);
    expect(m.statement).toBe("위와 같은 금액을 청구하오니, 결재하여 주시기 바랍니다.");
    expect(m.date).toBe("2026년 10월 20일");
    expect(m.signer).toBe("작성자: 홍길동 (인)");
    expect(m.approval.map((a) => a.status)).toEqual(["승인 10/20", "승인 10/21"]);
  });

  it("월 청구형: 계정과목·지출 증빙·비고, {기간} 치환, 소계", () => {
    const m = buildDocModel(PRESETS.monthly.layout, SAMPLE_DOC, { companyName: "가나다" });
    expect(m.table.rows[0].cells).toEqual(["10/14", "복리후생비", "부서 정기 점심 식사", "35,800", "카드", "3명 · 홍길동, 김철수, 이영희"]);
    expect(m.table.rows[2].cells[4]).toBe("현금영수증");
    expect(m.table.total?.[0]).toBe("소계");
    expect(m.statement).toBe("상기와 같이 2026-10-14 ~ 2026-10-17 지출한 경비를 청구합니다.");
  });

  it("내역·입금형: 입금 정보, 회사 이름. 계좌가 없으면 빈칸", () => {
    const m = buildDocModel(PRESETS.detailed.layout, SAMPLE_DOC, { companyName: "주식회사 가나다" });
    expect(m.footer).toEqual([{ label: "입금 정보", value: "가나은행 / 123-456-7890 / 홍길동", wide: true }]);
    expect(m.companyLine).toBe("주식회사 가나다");
    const noBank = buildDocModel(PRESETS.detailed.layout, { ...SAMPLE_DOC, member: { ...SAMPLE_DOC.member, bank: null } }, { companyName: "x" });
    expect(noBank.footer[0].value).toBe("");
  });

  it("출장 칸은 출장 결의서에서만, 세무 패키지의 다른 달 항목은 회색", () => {
    const m = buildDocModel(DEFAULT_LAYOUT, SAMPLE_DOC, { companyName: "x", evidenceNo: new Map([["s1", "2610-001"]]) });
    expect(m.header.some((h) => h.label === "출장지")).toBe(false);
    expect(m.table.rows.map((r) => [r.cells[0], r.dim])).toEqual([
      ["2610-001", false],
      ["다른 달", true],
      ["다른 달", true],
    ]);
    expect(m.dimNote).not.toBeNull();
    const trip = buildDocModel(DEFAULT_LAYOUT, { ...SAMPLE_DOC, is_business_trip: true, trip_destination: "부산", trip_start_date: "2026-10-14", trip_end_date: "2026-10-15", trip_purpose: "점검" }, { companyName: "x" });
    expect(trip.header.find((h) => h.label === "출장 기간")?.value).toBe("2026-10-14 ~ 2026-10-15");
    expect(trip.table.rows[0].cells[0]).toBe("1");
    expect(trip.dimNote).toBeNull();
  });
});
