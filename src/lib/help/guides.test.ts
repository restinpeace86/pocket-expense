import { describe, expect, it } from "vitest";
import { guidePath, guidesFor, HELP_GUIDES, rankGuides } from "./guides";

describe("도움말 글 고르기", () => {
  it("자연어 질문 → 가까운 글이 맨 앞", () => {
    expect(rankGuides("영수증 올렸는데 단가 수정은 어떻게 해요?", guidesFor(false))[0].id).toBe("claim-edit-item");
    expect(rankGuides("휴가 취소는 어떻게 해요", guidesFor(false))[0].id).toBe("leave-request");
    expect(rankGuides("출근 QR 찍는 법", guidesFor(false))[0].id).toBe("qr-attend");
    expect(rankGuides("회사 주소 바꾸고 싶어요", guidesFor(true))[0].id).toBe("company-location");
    expect(rankGuides("직원 연차는 어디서 정해요?", guidesFor(true))[0].id).toBe("leave-admin");
    expect(rankGuides("설정 메뉴가 어디 있어요", guidesFor(true))[0].id).toBe("settings-map");
  });
  it("관계없는 말이면 없음, 직원에게 관리자 글은 안 감", () => {
    expect(rankGuides("ㅋ", guidesFor(false))).toEqual([]);
    expect(guidesFor(false).some((g) => g.audience === "admin")).toBe(false);
    expect(rankGuides("식대 한도 바꾸기", guidesFor(false)).some((g) => g.id === "meal-limit")).toBe(false);
  });
  it("글 id 겹치지 않음, 이동 주소", () => {
    expect(new Set(HELP_GUIDES.map((g) => g.id)).size).toBe(HELP_GUIDES.length);
    const d = HELP_GUIDES.find((g) => g.id === "device-alerts")!;
    expect(guidePath(d, true)).toBe("/admin/device-alerts");
    expect(guidePath(d, false)).toBe("/employee/profile");
  });
});

describe("회사가 쓰는 기능만", () => {
  it("근태 꺼진 회사엔 근태 글이 없음(이동하면 없는 화면이라)", () => {
    const off = guidesFor(false, { attendance: false, calendar: true, chat: true, bus: false });
    expect(off.some((g) => g.id === "leave-request" || g.id === "qr-attend" || g.id === "bus")).toBe(false);
    expect(off.some((g) => g.id === "my-requests")).toBe(true);
  });
});
