import { describe, expect, it } from "vitest";
import { claimCutoff, deadlineDate, isOverdue, kstDate, prevWorkingDay, settlementMonth, taxCloseDue } from "./deadline";

// DB 테스트 056과 같은 날짜(D-161)
const holidays = ["2026-10-05", "2026-10-09", "2027-01-01"];
const p = { holidays };

describe("고정 청구 마감 (다음 달 2일 · 세무 마감 5일, 쉬는 날이면 앞 영업일)", () => {
  it("평일이면 그대로", () => {
    expect(claimCutoff("2026-09", holidays)).toBe("2026-10-02");
    expect(deadlineDate("2026-09-20", p)).toBe("2026-10-02");
  });
  it("주말·공휴일이면 앞 영업일", () => {
    expect(claimCutoff("2026-12", holidays)).toBe("2026-12-31"); // 1/2 토, 1/1 신정
    expect(taxCloseDue("2026-09", holidays)).toBe("2026-10-02"); // 10/5 대체공휴일, 10/3·4 주말
    expect(prevWorkingDay("2026-11-01", holidays)).toBe("2026-10-30");
  });
  it("마감 당일 상신은 제때, 다음 날부터 늦은 청구", () => {
    expect(isOverdue("2026-09-20", p, "2026-10-02")).toBe(false);
    expect(isOverdue("2026-09-20", p, "2026-10-03")).toBe(true);
    expect(deadlineDate(null, p)).toBeNull();
  });
  it("늦은 청구는 상신한 달 정산", () => {
    expect(settlementMonth("2026-09-20", p, "2026-10-02")).toBe("2026-09");
    expect(settlementMonth("2026-09-20", p, "2026-10-05")).toBe("2026-10");
    expect(settlementMonth("2026-09-20", p, "2026-11-10")).toBe("2026-11");
  });
  it("상신 시각은 한국 날짜로", () => {
    expect(kstDate("2026-10-05T16:30:00Z")).toBe("2026-10-06");
  });
});
