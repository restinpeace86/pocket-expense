import { ImageResponse } from "next/og";

// 앱 아이콘(홈 화면 추가·알림 아이콘, D-116). 크기: 96 / 180 / 192 / 512
const SIZES = new Set([96, 180, 192, 512]);
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)", color: "white", fontSize: size * 0.6, fontWeight: 800, fontFamily: "sans-serif" }}>
        P
      </div>
    ),
    { width: size, height: size },
  );
}
