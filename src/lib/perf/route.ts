// 체감 성능 기록용 화면 경로: id·초대 코드 같은 값은 지우고 화면 종류만 남긴다(개인정보·회사 식별값 없음)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeRoute(pathname: string): string {
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  const out = parts.map((seg, i) => {
    if (UUID.test(seg)) return "[id]";
    if (parts[i - 1] === "join" && seg !== "i") return "[code]";
    if (parts[i - 1] === "i" && parts[i - 2] === "join") return "[token]";
    return seg;
  });
  return ("/" + out.join("/")).slice(0, 120);
}

// 기록하는 화면: 로그인 후 화면만(공개 화면은 기록 함수가 로그인 사용자만 받는다)
export const shouldRecordRoute = (pathname: string) => pathname.startsWith("/workspace/") || pathname.startsWith("/onboarding");
