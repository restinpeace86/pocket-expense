// 관리자 1:1 문의(카카오톡 채널 채팅) 주소 — 7차 개선사항 3, D-127
// 환경변수 NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL(예: https://pf.kakao.com/_abcde/chat)로 바꾼다.
// 비어 있거나 카카오톡 채널 주소가 아니면 버튼을 숨긴다(잘못된 링크로 보내지 않게).
const CHANNEL_CHAT = /^https:\/\/pf\.kakao\.com\/_[A-Za-z0-9]+\/chat\/?$/;

export function feedbackUrl(raw: string | undefined): string | null {
  const url = raw?.trim();
  return url && CHANNEL_CHAT.test(url) ? url : null;
}

export const ADMIN_FEEDBACK_URL = feedbackUrl(process.env.NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL);
