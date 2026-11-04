import { describe, expect, it } from "vitest";
import { navVisibility } from "./nav-visibility";

describe("직원 하단 메뉴 보이는 곳(D-207)", () => {
  const ws = "/workspace/c1";
  it("홈·정산·내 정보·결재함 목록·캘린더·채팅 목록 = 보임", () => {
    for (const p of ["/employee", "/employee/settlements", "/employee/profile", "/approvals", "/calendar", "/chat"]) expect(navVisibility(ws + p, ws)).toBe("all");
  });
  it("대화방 = PC만, 결의서·결재 화면·관리자 = 숨김", () => {
    expect(navVisibility(`${ws}/chat/r1`, ws)).toBe("pc");
    for (const p of ["/employee/claims/new", "/employee/claims/x/edit", "/approvals/x", "/admin", "/admin/claims"]) expect(navVisibility(ws + p, ws)).toBe("none");
  });
});
