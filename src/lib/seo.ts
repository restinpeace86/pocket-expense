import { configuredSiteUrl } from "@/lib/site-url";
import { BRAND } from "@/lib/brand";

// 검색·공유용 기본 정보 (7차 개선사항 6, D-129)
export const SITE_NAME = BRAND.name;
export const SITE_TITLE = `${BRAND.name} - ${BRAND.slogan.replace(/\.$/, "")} · 작은 회사 통합 운영관리`;
export const SITE_DESCRIPTION =
  `5~20인 작은 회사를 위한 통합 운영관리 ${BRAND.name}. 영수증 사진으로 AI가 지출결의서를 채우고, QR 출퇴근·연차·휴가 신청과 전자결재, 사내 채팅·일정 공유·회의실 예약, 월말 세무사무소 자료 전달까지 한 구독으로 씁니다.`;
export const SITE_KEYWORDS = [
  BRAND.name,
  BRAND.nameEn,
  "다모은랩",
  "소규모 회사 그룹웨어",
  "통합 운영관리",
  "사내 메신저",
  "회의실 예약",
  "일정 공유 캘린더",
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
  // D-313: 근태·휴가·전자결재(랜딩에 있는 기능)
  "근태관리",
  "출퇴근 기록",
  "QR 출퇴근",
  "연차 관리",
  "휴가 신청",
  "전자결재",
  "품의서",
  "작은 회사 그룹웨어",
];

// 운영 주소(NEXT_PUBLIC_SITE_URL → Vercel 운영 도메인). 둘 다 없으면(로컬 개발) localhost
export function siteOrigin(): string {
  return configuredSiteUrl() || "http://localhost:3000";
}

// 네이버 서치어드바이저 소유 확인 값(사용자 2026-11-24, 사이트에 공개되는 값이라 코드에 둠 — Vercel NAVER_SITE_VERIFICATION이 있으면 그 값이 먼저). 구글은 도메인 속성·가비아 DNS TXT로 확인해 태그 불필요
export const NAVER_SITE_VERIFICATION_DEFAULT = "7a977572c96947f9ded8cb1e16f4fbaa990b7a66";

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

// 공개 화면을 마지막으로 고친 날(D-313): 사이트맵 lastModified. 요청마다 "오늘"이면 검색 로봇이 바뀐 날을 믿지 않는다 → 랜딩·약관을 고치면 이 날짜도 바꾼다
export const PUBLIC_UPDATED = "2026-11-24";

// 사이트맵에 넣는 공개 화면
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

// 구조화 데이터(JSON-LD, D-313): 검색 결과에 회사·서비스 이름을 바르게 보이게. 가격·별점은 넣지 않음(가격은 DB에서 바뀌고, 별점은 실제 리뷰가 없음)
export function structuredData(origin: string, op: { name: string; email: string }) {
  const org = { "@type": "Organization", "@id": `${origin}/#org`, name: op.name, url: origin, email: op.email, logo: `${origin}/icons/512` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      { "@type": "WebSite", "@id": `${origin}/#site`, name: SITE_NAME, alternateName: BRAND.nameEn, url: origin, inLanguage: "ko-KR", publisher: { "@id": org["@id"] } },
      { "@type": "SoftwareApplication", name: SITE_NAME, alternateName: BRAND.nameEn, url: origin, applicationCategory: "BusinessApplication", operatingSystem: "Web, Android", description: SITE_DESCRIPTION, inLanguage: "ko-KR", publisher: { "@id": org["@id"] } },
    ],
  };
}
