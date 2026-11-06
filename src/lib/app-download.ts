// 안드로이드 설치 앱 내려받기(D-228, spec/features/android-app.md)
// 설치 파일(APK)은 Supabase 공개 저장소 app-downloads에 늘 같은 이름으로 올린다(새 버전은 덮어씀).
export const ANDROID_APP_VERSION = "1.0.1";
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
