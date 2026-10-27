import { configuredSiteUrl } from "@/lib/site-url";

// 검색·공유용 기본 정보 (7차 개선사항 6, D-129)
export const SITE_NAME = "PocketExpense";
export const SITE_TITLE = "PocketExpense - 영수증 사진 한 장으로 끝내는 경비 정산·지출결의서";
export const SITE_DESCRIPTION =
  "소기업·스타트업을 위한 AI 경비 정산 SaaS. 영수증 사진만 찍으면 AI가 지출결의서를 채우고, 카카오톡으로 결재하고, 월말 세무사무소 제출용 엑셀·영수증 ZIP까지 한 번에 정리합니다.";
export const SITE_KEYWORDS = [
  "경비 정산",
  "경비처리",
  "지출결의서",
  "영수증 관리",
  "영수증 정리 앱",
  "AI 영수증 인식",
  "법인카드 정산",
  "사비 정산",
  "세무사무소 엑셀",
  "소기업 경비 관리",
  "스타트업 경비 정산",
  "카카오톡 결재",
];

// 운영 주소(NEXT_PUBLIC_SITE_URL → Vercel 운영 도메인). 둘 다 없으면(로컬 개발) localhost
export function siteOrigin(): string {
  return configuredSiteUrl() || "http://localhost:3000";
}

// 검색 사이트 소유 확인 값: 구글 서치 콘솔·네이버 서치어드바이저가 준 문자열을 환경변수에 넣는다(비우면 태그를 넣지 않음)
export function verificationTags(env: Record<string, string | undefined> = process.env) {
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  const naver = env.NAVER_SITE_VERIFICATION?.trim();
  if (!google && !naver) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(naver ? { other: { "naver-site-verification": naver } } : {}),
  };
}

// 검색 로봇이 들어가지 않을 곳: 로그인 뒤 화면·운영자·내부 주소(공개 화면만 수집)
export const ROBOTS_DISALLOW = ["/workspace/", "/onboarding", "/app-admin", "/api/", "/auth/", "/dev/", "/join/", "/share/", "/push/"];

// 사이트맵에 넣는 공개 화면
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];
