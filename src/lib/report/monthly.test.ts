import { describe, expect, it } from "vitest";
import { buildMonthlyReport, manwon, prevMonthOf, reportCard, type ReportItem } from "./monthly";

const items: ReportItem[] = [
  { ym: "2026-10", amount: 520000, account: "복리후생비", member: "김영업" },
  { ym: "2026-10", amount: 380000, account: "여비교통비", member: "박개발" },
  { ym: "2026-10", amount: 100000, account: "복리후생비", member: "김영업" },
  { ym: "2026-10", amount: 12000, account: null, member: "이디자" },
  { ym: "2026-10", amount: 5000, account: "소모품비", member: "최직원" },
  { ym: "2026-09", amount: 800000, account: "복리후생비", member: "김영업" },
  { ym: "2026-08", amount: 999999, account: "복리후생비", member: "김영업" },
];

describe("지난달 지출 리포트(D-319)", () => {
  it("달 계산", () => {
    expect(prevMonthOf("2026-01")).toBe("2025-12");
  });
  it("합계·전월·상위 3개(계정과목·사람)", () => {
    const r = buildMonthlyReport("2026-10", items, null);
    expect(r).toMatchObject({ total: 1017000, prev: 800000, count: 5 });
    expect(r.titles.map((t) => t.name)).toEqual(["복리후생비", "여비교통비", "미지정"]);
    expect(r.members).toEqual([
      { name: "김영업", amount: 620000 },
      { name: "박개발", amount: 380000 },
      { name: "이디자", amount: 12000 },
    ]);
  });
  it("만 원 단위", () => {
    expect(manwon(5000)).toBe("5,000원");
    expect(manwon(12340)).toBe("1.2만");
    expect(manwon(520000)).toBe("52만");
    expect(manwon(3450000)).toBe("345만");
  });
  it("카드 문구 — 늘었어요·예산", () => {
    const c = reportCard(buildMonthlyReport("2026-10", items, 2000000));
    expect(c.title).toBe("10월 지출 리포트");
    expect(c.lines[0]).toBe("총 1,017,000원(5건) · 9월보다 27% 늘었어요");
    expect(c.lines[1]).toBe("많이 쓴 곳: 복리후생비 62만 · 여비교통비 38만 · 미지정 1.2만");
    expect(c.lines[2]).toBe("많이 쓴 사람: 김영업 62만 · 박개발 38만 · 이디자 1.2만");
    expect(c.lines[3]).toBe("회사 예산 200만 중 51% 썼어요");
  });
  it("전월 없음·줄었어요", () => {
    expect(reportCard(buildMonthlyReport("2026-09", items, null)).lines[0]).toBe("총 800,000원(1건) · 8월보다 20% 줄었어요");
    expect(reportCard(buildMonthlyReport("2026-08", items, null)).lines[0]).toContain("7월 지출은 없었어요");
  });
});
