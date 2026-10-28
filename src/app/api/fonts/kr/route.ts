import { NextResponse, type NextRequest } from "next/server";
import { getMembership } from "@/lib/auth/session";
import { getMyTaxOffice, isActiveMember } from "@/lib/tax-office/queries";

// 지출결의서 PDF용 한글 글꼴(Noto Sans KR) — 쓰는 글자만 담은 TTF (T10-3b, D-092)
// 브라우저가 PDF를 만들 때 쓴다. Google Fonts는 글자가 너무 많으면 전체 글꼴(약 6MB)을 주므로 한 번에 400자까지만 받는다.
const MAX_CHARS = 400;

export async function POST(request: NextRequest) {
  // 회사 멤버 또는 세무사무소 구성원(사무소 증빙 묶음의 지출결의서 PDF, D-153)
  const m = await getMembership();
  if (!(m && m.status === "approved") && !isActiveMember(await getMyTaxOffice())) return new NextResponse("Not Found", { status: 404 });
  const body = (await request.json().catch(() => null)) as { chars?: string; weight?: number } | null;
  const chars = [...new Set([...(body?.chars ?? "")])].join("");
  const weight = body?.weight === 700 ? 700 : 400;
  if (!chars || [...chars].length > MAX_CHARS) return new NextResponse("Bad Request", { status: 400 });
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(chars)}`, { signal: AbortSignal.timeout(8000) })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return new NextResponse("Font unavailable", { status: 502 });
    const font = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!font.ok) return new NextResponse("Font unavailable", { status: 502 });
    return new NextResponse(await font.arrayBuffer(), { headers: { "Content-Type": "font/ttf", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new NextResponse("Font unavailable", { status: 502 });
  }
}
