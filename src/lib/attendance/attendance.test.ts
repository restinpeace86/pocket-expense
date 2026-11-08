import { describe, expect, it } from "vitest";
import { alertLabel, isOpenHour, stayLabel, validateSettings, type AttendanceSettings } from "./rules";
import { makeToken, SLOT_MS, slotOf, verifyToken } from "./token";

const C = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";

describe("QR 토큰 (30초 칸, 직전 칸까지)", () => {
  const now = 1_800_000_000_000;
  const tok = makeToken("s", C, T, slotOf(now));
  it("지금 칸·직전 칸은 통과, 그 전은 만료", () => {
    expect(verifyToken("s", tok, now)).toMatchObject({ ok: true, companyId: C, terminalId: T });
    expect(verifyToken("s", tok, now + SLOT_MS)).toMatchObject({ ok: true });
    expect(verifyToken("s", tok, now + 2 * SLOT_MS)).toEqual({ ok: false, error: "EXPIRED" });
  });
  it("퇴근 확인은 더 넓게(maxBack)", () => {
    expect(verifyToken("s", tok, now + 4 * SLOT_MS, 5)).toMatchObject({ ok: true });
  });
  it("다른 비밀키·고친 토큰·미래 칸은 거절", () => {
    expect(verifyToken("x", tok, now)).toEqual({ ok: false, error: "INVALID" });
    expect(verifyToken("s", tok.replace(T, C), now)).toEqual({ ok: false, error: "INVALID" });
    expect(verifyToken("s", "garbage", now)).toEqual({ ok: false, error: "INVALID" });
    expect(verifyToken("s", makeToken("s", C, T, slotOf(now) + 1), now)).toEqual({ ok: false, error: "EXPIRED" });
  });
});

describe("근태 규칙", () => {
  it("QR은 한국 시간 06시부터", () => {
    expect(isOpenHour(new Date("2026-11-08T20:59:00Z"))).toBe(false); // 05:59 KST
    expect(isOpenHour(new Date("2026-11-08T21:00:00Z"))).toBe(true); // 06:00 KST
  });
  it("머문 시간", () => {
    expect(stayLabel("2026-11-09T08:57:00+09:00", "2026-11-09T18:12:00+09:00")).toBe("9시간 15분");
    expect(stayLabel("2026-11-09T08:00:00+09:00", "2026-11-09T08:40:00+09:00")).toBe("40분");
    expect(stayLabel("2026-11-09T08:00:00+09:00", "2026-11-09T17:00:00+09:00")).toBe("9시간");
  });
  it("누락 알림 시각(자정 넘으면 23:50)", () => {
    expect(alertLabel("18:00", 60)).toBe("정규 퇴근 1시간 뒤 (19:00)");
    expect(alertLabel("18:00", 90)).toBe("정규 퇴근 1시간 30분 뒤 (19:30)");
    expect(alertLabel("18:00", 30)).toBe("정규 퇴근 30분 뒤 (18:30)");
    expect(alertLabel("22:30", 180)).toBe("정규 퇴근 3시간 뒤 (23:50)");
  });
  it("설정 검사", () => {
    const ok: AttendanceSettings = { work_start: "09:00", work_end: "18:00", daily_hours: 8, work_days: [1, 2, 3, 4, 5], missing_alert_minutes: 60, leave_year_basis: "calendar", under_five: false };
    expect(validateSettings(ok)).toBeNull();
    expect(validateSettings({ ...ok, work_end: "08:00" })).toMatch(/늦어야/);
    expect(validateSettings({ ...ok, work_start: "09:05" })).toMatch(/10분/);
    expect(validateSettings({ ...ok, work_days: [] })).toMatch(/요일/);
    expect(validateSettings({ ...ok, missing_alert_minutes: 45 })).toMatch(/알림/);
  });
});
