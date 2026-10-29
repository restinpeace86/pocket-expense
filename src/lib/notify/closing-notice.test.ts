import { describe, expect, it } from "vitest";
import { closingNotice } from "./templates";

const base = { companyId: "c1", companyName: "한빛", month: "2026-09", cutoff: "2026-10-02", due: "2026-10-02" };

describe("월말 마감 알림 문구 (D-161·D-166)", () => {
  it("5일: 승인 대기가 있으면 승인·반려 독촉이 먼저, 버튼은 승인 대기", () => {
    const m = closingNotice({ ...base, kind: "close_due", pending: 3, closed: false });
    expect(m.text).toBe("[한빛] 오늘(10/2)이 9월 지출 세무 마감일이에요. 9월까지 쓴 결의서 3건이 아직 승인 대기 중이에요. 오늘까지 승인 또는 반려해 주세요. 처리하지 않으면 9월 세무 자료에서 빠져요. 누락 내역을 확인하고 마감을 완료해 주세요.");
    expect(m.buttonPath).toBe("/workspace/c1/admin/claims?tab=pending");
  });
  it("5일: 이미 마감했고 대기만 있으면 마감 문구는 빼고 독촉만", () => {
    const m = closingNotice({ ...base, kind: "close_due", pending: 1, closed: true });
    expect(m.text).not.toContain("마감을 완료해 주세요");
    expect(m.text).toContain("1건이 아직 승인 대기 중이에요");
  });
  it("3일: 홈택스 자료를 올렸고 대기만 있으면 홈택스 문구 없음", () => {
    const m = closingNotice({ ...base, kind: "hometax_missing", pending: 2, hometaxMissing: false });
    expect(m.text).not.toContain("홈택스");
    expect(m.text).toContain("10/2까지 승인 또는 반려");
  });
  it("대기 없으면 기존 문구·세무 마감 버튼", () => {
    const m = closingNotice({ ...base, kind: "close_due", pending: 0, closed: false });
    expect(m.buttonLabel).toBe("세무 마감 열기");
    expect(m.text).toBe("[한빛] 오늘(10/2)이 9월 지출 세무 마감일이에요. 누락 내역을 확인하고 마감을 완료해 주세요.");
  });
});
