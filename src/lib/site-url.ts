// 초대·공유 링크의 앞주소 (D-099, D-113)
// 공유·초대 링크는 어디서 만들든 항상 운영(배포) 주소를 쓴다.
// - 로컬(localhost·사설 IP) 주소는 다른 사람이 열 수 없다.
// - 카카오톡 공유는 링크 도메인이 카카오 콘솔에 등록되지 않았으면 '등록된 첫 번째 도메인'(지금은 localhost:3000)으로 바꿔 버린다.
//   그래서 Vercel 미리보기 주소(pocket-expense-git-…)에서 공유해도 운영 주소로 보낸다(D-113).
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])$/i;

const trim = (s: string | undefined) => (s ?? "").trim().replace(/\/+$/, "");

// 배포 주소: NEXT_PUBLIC_SITE_URL → (없으면) Vercel이 넣어 주는 운영 도메인
export function configuredSiteUrl(): string {
  const explicit = trim(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;
  const vercel = trim(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return vercel ? `https://${vercel.replace(/^https?:\/\//, "")}` : "";
}

export function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOST.test(new URL(origin).hostname);
  } catch {
    return true;
  }
}

// 링크 앞주소: 배포 주소(NEXT_PUBLIC_SITE_URL → Vercel 운영 도메인) → 둘 다 없으면 지금 주소(로컬이어도 그대로 — 개발 중에만 생기는 경우)
export function publicOrigin(current: string = typeof window === "undefined" ? "" : window.location.origin): string {
  return configuredSiteUrl() || trim(current);
}
