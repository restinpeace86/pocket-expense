import { describe, expect, it } from "vitest";
import { matchFilter, prevMonth, rowTone, sortRows, todoItems, type ClientRow, type ClientStatus } from "./dashboard";

const st = (p: Partial<ClientStatus>): ClientStatus => ({ company_id: "x", closed: false, closed_at: null, requests_open: 0, requests_answered: 0, unread: 0, ...p });
const row = (name: string, s: Partial<ClientStatus> | null): ClientRow => ({ company_id: name, company_name: name, business_number: null, assigned_member_id: null, assigned_name: null, status: s ? st(s) : null });

describe("세무사무소 현황판 (D-268)", () => {
  it("색: 확인할 것 → 빨강, 마감 → 초록, 그 외 주황", () => {
    expect(rowTone(st({ missing_receipts: 1, closed: true }))).toBe("alert");
    expect(rowTone(st({ closed: true }))).toBe("done");
    expect(rowTone(st({ closed: true, requests_open: 1 }))).toBe("done"); // 회사 답을 기다리는 요청은 빨강 아님
    expect(rowTone(st({}))).toBe("wait");
    expect(rowTone(null)).toBe("wait");
  });
  it("확인할 것 글자", () => {
    expect(todoItems(st({ unread: 1, missing_receipts: 2, pending_claims: 3, hometax_missing: true, requests_open: 1, requests_acked: 1 }))).toEqual([
      "새 확인 요청 1",
      "영수증 없는 지출 2",
      "승인 대기 3",
      "홈택스 안 올림",
      "답변 대기 1(확인함 1)",
    ]);
  });
  it("필터·정렬: 할 일 많은 곳 위, 같으면 이름순", () => {
    const rows = [row("다", { closed: true }), row("가", { unread: 1 }), row("나", { closed: false })];
    expect(sortRows(rows, "todo").map((r) => r.company_name)).toEqual(["가", "나", "다"]);
    expect(sortRows(rows, "name").map((r) => r.company_name)).toEqual(["가", "나", "다"]);
    expect(rows.filter((r) => matchFilter(r, "closed")).map((r) => r.company_name)).toEqual(["다"]);
    expect(rows.filter((r) => matchFilter(r, "unchecked")).length).toBe(3);
  });
  it("지난달", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2026-11")).toBe("2026-10");
  });
});
