// 초대·공유 링크의 앞주소 (todo_improvement(2차) 6, D-099)
// 로컬(localhost·사설 IP)에서 만든 링크는 다른 사람이 열 수 없으므로 운영 주소를 쓴다.
// 운영·프리뷰 배포에서는 지금 접속한 주소를 그대로 쓴다(프리뷰에서 만든 링크는 그 프리뷰로).
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

// 브라우저에서 링크를 만들 때: 지금 주소가 로컬이면 배포 주소, 아니면 지금 주소
export function publicOrigin(current: string = typeof window === "undefined" ? "" : window.location.origin): string {
  const cur = trim(current);
  if (cur && !isLocalOrigin(cur)) return cur;
  return configuredSiteUrl() || cur;
}
