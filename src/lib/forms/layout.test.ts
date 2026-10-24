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

  it("회사 추가 칸: 직원 작성 값·고정값·빈칸, 직원 작성 칸은 최대 3개(넘으면 빈칸)", () => {
    const l = normalizeLayout({
      ...PRESETS.itemized.layout,
      header: [
        { key: "custom.proj0001", label: "프로젝트", mode: "input", required: true, options: ["A", "B", "A"] },
        { key: "custom.keep0001", label: "보존기간", mode: "fixed", value: "5년" },
        { key: "custom.stmp0001", label: "확인", mode: "blank" },
        { key: "custom.in020001", label: "예산", mode: "input" },
        { key: "custom.in030001", label: "코드", mode: "input" },
        { key: "custom.in040001", label: "넷째", mode: "input" },
        { key: "custom.BAD!", label: "x", mode: "input" },
      ],
    });
    expect(l.header.map((h) => ("mode" in h ? `${h.label}:${h.mode}` : h.label))).toEqual(["프로젝트:input", "보존기간:fixed", "확인:blank", "예산:input", "코드:input", "넷째:blank"]);
    expect(l.header[0]).toMatchObject({ required: true, options: ["A", "B"] });
    const m = buildDocModel(l, { ...SAMPLE_DOC, header_custom: { "custom.proj0001": "A" } }, { companyName: "x" });
    expect(m.header.map((h) => `${h.label}=${h.value}`)).toEqual(["프로젝트=A", "보존기간=5년", "확인=", "예산=", "코드=", "넷째="]);
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

  it("품목 표형(A안): 영수증 품목마다 한 줄, 품목 없으면 한 줄(수량 1), 품목 합과 다르면 할인 줄 — 합계는 영수증과 같다", () => {
    const m = buildDocModel(PRESETS.itemized.layout, SAMPLE_DOC, { companyName: "가나다" });
    expect(m.table.rows.map((r) => r.cells)).toEqual([
      ["1", "점심 정식", "3", "11,000", "33,000", "10/14 한식당 소담"],
      ["2", "음료", "2", "1,400", "2,800", ""],
      ["3", "거래처 신제품 협의", "1", "16,500", "16,500", "10/16 카페 온도"],
      ["4", "A4 복사지", "2", "15,000", "30,000", "10/17 다이소"],
      ["5", "볼펜 세트", "3", "7,500", "22,500", ""],
      ["6", "할인", "", "", "-1,500", ""],
    ]);
    expect(m.table.total).toEqual(["합계", "", "", "", "103,300", ""]);
  });

  it("수량·단가 열만 있고 품목 열이 없으면 적요 열이 품목 이름", () => {
    const layout = { ...PRESETS.itemized.layout, columns: PRESETS.itemized.layout.columns.map((c) => (c.key === "item.line_name" ? { key: "item.summary" as const, label: "적요" } : c)) };
    const m = buildDocModel(layout, SAMPLE_DOC, { companyName: "x" });
    expect(m.table.rows[1].cells.slice(0, 2)).toEqual(["2", "음료"]);
  });

  it("품목 금액을 모르면 영수증 한 줄로, 수량만 없으면 1", async () => {
    const { linesOf } = await import("./layout");
    const base = SAMPLE_DOC.items[0];
    expect(linesOf({ ...base, line_items: [{ name: "김밥", quantity: null, unit_price: null, amount: null }] })).toEqual([{ name: "부서 정기 점심 식사", quantity: 1, unitPrice: 35800, amount: 35800 }]);
    expect(linesOf({ ...base, amount: 9000, line_items: [{ name: "김밥", quantity: null, unit_price: 4500, amount: 9000 }] })).toEqual([{ name: "김밥", quantity: 2, unitPrice: 4500, amount: 9000 }]);
    expect(linesOf({ ...base, amount: 9000, line_items: [{ name: "김밥", quantity: null, unit_price: null, amount: 9000 }] })).toEqual([{ name: "김밥", quantity: 1, unitPrice: 9000, amount: 9000 }]);
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
