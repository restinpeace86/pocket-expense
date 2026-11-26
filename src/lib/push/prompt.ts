// 알림·홈 화면 추가 안내를 계정 기준으로(D-318, 사용자 2026-11-26 "브라우저 단위 말고 계정 단위로")
// - 이 계정(멤버)이 알림을 켠 기기·설치 앱이 하나라도 있으면 어디서도 묻지 않는다
// - [나중에]·닫기·한 번 보여 줌 = 계정에 '다음에 물을 날'(30일 뒤) 저장 → 다른 기기·브라우저에서도 그때까지 안 뜸
// - 홈 화면 아이콘으로 한 번이라도 열었으면(앱처럼 씀) 다시 묻지 않음(never)
// - 카카오톡 등 앱 안 브라우저에서는 띄우지 않는다(홈 화면 추가·알림이 제대로 안 되고, 기록도 금방 지워짐)
export const PUSH_PROMPT_KEY = "push_prompt_until";
export const PUSH_PROMPT_AGAIN_DAYS = 30;
export const PUSH_PROMPT_NEVER = "never";

export function promptAllowed(p: { devices: number; until: unknown; now: Date }): boolean {
  if (p.devices > 0) return false;
  if (p.until === PUSH_PROMPT_NEVER) return false;
  if (typeof p.until === "string" && !Number.isNaN(Date.parse(p.until))) return Date.parse(p.until) <= p.now.getTime();
  return true;
}

export function nextAskDate(now: Date, days = PUSH_PROMPT_AGAIN_DAYS): string {
  return new Date(now.getTime() + days * 86400_000).toISOString();
}

// 앱 안 브라우저(카카오톡·네이버·인스타그램·페이스북·라인 등)
export function isInAppBrowser(ua: string): boolean {
  return /KAKAOTALK|NAVER\(inapp|; wv\)|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|whale\/.*inapp/i.test(ua) && !/DamoOnApp/i.test(ua);
}
