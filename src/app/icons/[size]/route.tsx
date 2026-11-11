import { ImageResponse } from "next/og";

// 앱 아이콘(홈 화면 추가·알림 아이콘, D-116). 크기: 96 / 180 / 192 / 512
const SIZES = new Set([96, 180, 192, 512]);
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)" }}>
        {/* 모이는 M(D-252 로고) — 마스크 아이콘 안전 영역(가운데 80%) 안에 */}
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 44 44"><path d="M8 34V14l14 12 14-12v20" fill="none" stroke="white" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="8" r="4" fill="white" /></svg>
      </div>
    ),
    { width: size, height: size },
  );
}
