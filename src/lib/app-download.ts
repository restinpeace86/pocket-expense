// 안드로이드 설치 앱 내려받기(D-228, spec/features/android-app.md)
// 설치 파일(APK)은 Supabase 공개 저장소 app-downloads에 늘 같은 이름으로 올린다(새 버전은 덮어씀).
export const ANDROID_APP_VERSION = "1.0.2";
// 설치 파일을 저장소에 올린 뒤 true — 그 전에는 받기 버튼·안내 링크를 숨긴다(없는 파일로 보내지 않게)
export const ANDROID_APK_READY = true;
export const ANDROID_APK_PATH = "android/workon.apk";

export function androidApkUrl(env: Record<string, string | undefined> = process.env): string | null {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  return base && ANDROID_APK_READY ? `${base.replace(/\/$/, "")}/storage/v1/object/public/app-downloads/${ANDROID_APK_PATH}?v=${ANDROID_APP_VERSION}` : null;
}

// 설치 앱을 고를 이유(홈 화면 웹앱과 비교) — 안내 화면 여러 곳이 같은 글을 쓴다
export const ANDROID_APP_BENEFITS = [
  "채팅 알림이 길고 강하게 울려요 — 소리·진동을 휴대폰 설정에서 채팅만 따로 바꿀 수 있어요",
  "다른 앱을 쓰는 중에도 화면 위에 크게 떠서 놓치지 않아요",
  "화면·기능은 웹과 똑같고, 업데이트는 자동이에요(다시 설치할 필요 없음)",
] as const;

// ── 카카오톡 등 앱 안 브라우저에서는 설치 파일을 받아도 바로 설치 화면을 못 연다(D-231) ──────────────
// ("파일 관리자에서 직접 설치해 주세요"로 끝남) → 받기를 휴대폰 기본 브라우저(크롬)로 넘겨 받자마자 [열기] → 설치.
export type InAppBrowser = "kakaotalk" | "other" | null;
export function inAppBrowser(ua: string): InAppBrowser {
  if (!/Android/i.test(ua)) return null;
  if (/KAKAOTALK/i.test(ua)) return "kakaotalk";
  if (/NAVER\(inapp|Instagram|FBAN|FBAV|\bLine\/|BAND\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) return "other";
  return null;
}

// 앱 안 브라우저 밖(기본 브라우저)에서 이 주소를 열게 하는 주소. 카카오톡은 자체 주소, 그 밖은 크롬 열기
export function openOutsideUrl(url: string, kind: Exclude<InAppBrowser, null>): string {
  if (kind === "kakaotalk") return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
