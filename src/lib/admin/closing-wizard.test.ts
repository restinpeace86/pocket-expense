import { describe, expect, it } from "vitest";
import { closingProgress, closingSteps, showClosingHomeCard, type ClosingInput } from "./closing-wizard";

const base: ClosingInput = { month: "2026-10", pendingClaims: 0, hasCards: true, card: { kind: "none" }, hometaxFiles: 0, closed: false, officeName: null };

describe("월 마감 도우미 단계(D-315)", () => {
  it("법인카드가 있으면 4단계, 없으면 카드 대조를 뺀 3단계", () => {
    expect(closingSteps(base).map((s) => s.key)).toEqual(["approvals", "cards", "hometax", "handoff"]);
    expect(closingSteps({ ...base, hasCards: false }).map((s) => s.key)).toEqual(["approvals", "hometax", "handoff"]);
  });

  it("상태는 실제 데이터로 — 승인 대기 0건·대조 모두 처리·홈택스 1개 이상·마감 완료", () => {
    const s = closingSteps({ ...base, pendingClaims: 3, card: { kind: "open", open: 2, total: 5 } });
    expect(s[0]).toMatchObject({ done: false, status: "승인 대기 3건" });
    expect(s[1]).toMatchObject({ done: false, status: "처리 안 된 2건" });
    expect(s[2]).toMatchObject({ done: false, status: "10월 자료 아직 없음" });
    const d = closingSteps({ ...base, card: { kind: "done", total: 0 }, hometaxFiles: 2, closed: true });
    expect(d.every((x) => x.done)).toBe(true);
    expect(d[1].status).toBe("모두 맞음");
    expect(d[2].status).toBe("2개 올림");
  });

  it("세무사무소가 연결돼 있으면 마지막 단계 이름이 '알리기'", () => {
    expect(closingSteps({ ...base, officeName: "한빛세무" }).at(-1)?.title).toBe("마감하고 세무사무소에 알리기");
    expect(closingSteps(base).at(-1)?.title).toBe("마감하고 자료 받기");
  });

  it("진행률 = 끝난 단계 / 전체, 지금 단계 = 첫 미완료", () => {
    const p = closingProgress(closingSteps({ ...base, hasCards: false, hometaxFiles: 1 }));
    expect(p).toMatchObject({ total: 3, done: 2, percent: 67 });
    expect(p.current?.key).toBe("handoff");
    expect(closingProgress(closingSteps({ ...base, hasCards: false, hometaxFiles: 1, closed: true })).current).toBeNull();
  });

  it("홈 카드는 다음 달 안에서, 마감 전이고 할 거리가 있을 때만", () => {
    expect(showClosingHomeCard({ month: "2026-10", today: "2026-11-03", closed: false, hasWork: true })).toBe(true);
    expect(showClosingHomeCard({ month: "2026-10", today: "2026-11-30", closed: false, hasWork: true })).toBe(true);
    expect(showClosingHomeCard({ month: "2026-10", today: "2026-11-03", closed: true, hasWork: true })).toBe(false);
    expect(showClosingHomeCard({ month: "2026-10", today: "2026-11-03", closed: false, hasWork: false })).toBe(false);
    expect(showClosingHomeCard({ month: "2026-12", today: "2027-01-02", closed: false, hasWork: true })).toBe(true);
  });
});
