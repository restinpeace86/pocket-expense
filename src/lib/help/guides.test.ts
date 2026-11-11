import { describe, expect, it } from "vitest";
import { guidePath, guidesFor, isShortQuery, rankGuides, type HelpGuide } from "./guides";
import { HELP_SEED } from "./seed";

// 처음 데이터(seed)를 DB에서 읽은 모양으로 바꿔 시험한다
const ALL: HelpGuide[] = HELP_SEED.map((a) => ({
  id: a.id,
  cat: a.cat,
  audience: a.audience ?? "all",
  needs: a.needs ?? null,
  title: a.title,
  summary: a.summary,
  keywords: a.keywords,
  path: a.path,
  adminPath: a.adminPath,
  pathLabel: a.pathLabel,
  sim: a.sim,
  steps: a.steps.map((s) => ({ body: s.body, image: null, alt: null })),
}));
const emp = guidesFor(ALL, false);
const adm = guidesFor(ALL, true);
const top = (q: string, list = emp) => rankGuides(q, list)[0]?.id;

describe("도움말 글 고르기(D-255)", () => {
  it("문장 질문 → 가까운 글이 맨 앞", () => {
    expect(top("영수증 올렸는데 단가 수정은 어떻게 해요?")).toBe("claim-edit-item");
    expect(top("휴가 취소는 어떻게 해요")).toBe("leave-cancel");
    expect(top("출근 QR 찍는 법")).toBe("qr-attend");
    expect(top("퇴근을 안 찍었는데 어떻게 해요?")).toBe("attendance-fix");
    expect(top("회사 주소 바꾸고 싶어요", adm)).toBe("company-location");
    expect(top("직원 연차는 어디서 정해요?", adm)).toBe("leave-admin");
    expect(top("설정 메뉴가 어디 있어요", adm)).toBe("settings-map");
  });
  it("단어 하나로도 찾음", () => {
    for (const [q, id] of [["퇴근", "qr-attend"], ["연차", "leave-request"], ["정산", "settlement"], ["버스", "bus"], ["회의실", "room-booking"], ["알림", "device-alerts"]] as const)
      expect(rankGuides(q, emp).map((g) => g.id)).toContain(id);
    expect(rankGuides("양식", emp).length).toBeGreaterThan(0); // 직원도 휴가신청서 양식 글이 나옴
    expect(isShortQuery("퇴근")).toBe(true);
    expect(isShortQuery("퇴근 안 찍었어요")).toBe(false);
  });
  it("관계없는 말이면 없음, 직원에게 관리자 글은 안 감, 꺼진 기능 글도 안 감", () => {
    expect(rankGuides("ㅋ", emp)).toEqual([]);
    expect(emp.some((g) => g.audience === "admin")).toBe(false);
    const off = guidesFor(ALL, false, { attendance: false, calendar: true, chat: true, bus: false });
    expect(off.some((g) => g.id === "leave-request" || g.id === "qr-attend" || g.id === "bus")).toBe(false);
    expect(off.some((g) => g.id === "my-requests")).toBe(true);
  });
  it("글 id 겹치지 않음, 단계 있음, 이동 주소", () => {
    expect(new Set(ALL.map((g) => g.id)).size).toBe(ALL.length);
    expect(ALL.every((g) => g.steps.length >= 1 && g.steps.every((s) => s.body.length <= 500))).toBe(true);
    const d = ALL.find((g) => g.id === "device-alerts")!;
    expect(guidePath(d, true)).toBe("/admin/device-alerts");
    expect(guidePath(d, false)).toBe("/employee/profile");
  });
});
