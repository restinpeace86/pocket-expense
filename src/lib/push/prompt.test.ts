import { describe, expect, it } from "vitest";
import { isInAppBrowser, nextAskDate, promptAllowed } from "./prompt";

const now = new Date("2026-11-26T00:00:00Z");

describe("알림 안내 계정 기준(D-318)", () => {
  it("알림 켠 기기·앱이 하나라도 있으면 안 물음", () => {
    expect(promptAllowed({ devices: 1, until: null, now })).toBe(false);
  });
  it("처음이면 물음, 다음에 물을 날 전이면 안 물음, 지나면 다시", () => {
    expect(promptAllowed({ devices: 0, until: undefined, now })).toBe(true);
    expect(promptAllowed({ devices: 0, until: nextAskDate(now), now })).toBe(false);
    expect(promptAllowed({ devices: 0, until: "2026-11-01T00:00:00Z", now })).toBe(true);
  });
  it("홈 화면 앱으로 쓴 계정은 다시 안 물음", () => {
    expect(promptAllowed({ devices: 0, until: "never", now })).toBe(false);
  });
  it("다음에 물을 날 = 30일 뒤", () => {
    expect(nextAskDate(now)).toBe("2026-12-26T00:00:00.000Z");
  });
  it("앱 안 브라우저는 띄우지 않음, 우리 설치 앱·일반 브라우저는 제외", () => {
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 KAKAOTALK 10.8.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.8.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 NAVER(inapp; search; 1000; 12.0)")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 Chrome/120 Mobile DamoOnApp/android")).toBe(false);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36")).toBe(false);
    expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});
