import { describe, expect, it } from "vitest";
import { inAppBrowser, openOutsideUrl } from "./app-download";

const KAKAO = "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 KAKAOTALK/25.9.1 (INAPP)";
const CHROME = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36";
const NAVER = "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.0.0)";
const IOS_KAKAO = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 25.9.1";

describe("앱 안 브라우저에서 설치 파일 받기 (D-231)", () => {
  it("안드로이드 카카오톡·네이버 앱 안 브라우저만 골라낸다", () => {
    expect(inAppBrowser(KAKAO)).toBe("kakaotalk");
    expect(inAppBrowser(NAVER)).toBe("other");
    expect(inAppBrowser(CHROME)).toBeNull();
    expect(inAppBrowser(SAMSUNG)).toBeNull();
    expect(inAppBrowser(IOS_KAKAO)).toBeNull();
  });
  it("카카오톡은 기본 브라우저로, 그 밖은 크롬으로 연다", () => {
    const apk = "https://x.supabase.co/storage/v1/object/public/app-downloads/android/workon.apk?v=1.0.1";
    expect(openOutsideUrl(apk, "kakaotalk")).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(apk)}`);
    expect(openOutsideUrl(apk, "other")).toBe(
      `intent://x.supabase.co/storage/v1/object/public/app-downloads/android/workon.apk?v=1.0.1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(apk)};end`,
    );
  });
});
