import { ImageResponse } from "next/og";

// 앱 아이콘(홈 화면 추가·알림 아이콘, D-116). 크기: 96 / 180 / 192 / 512
const SIZES = new Set([96, 180, 192, 512]);
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)" }}>
        {/* 켜진 스위치(D-221 로고) — 마스크 아이콘 안전 영역(가운데 80%) 안에 */}
        <div style={{ width: size * 0.56, height: size * 0.32, borderRadius: size, background: "white", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: size * 0.04 }}>
          <div style={{ width: size * 0.24, height: size * 0.24, borderRadius: size, background: "#4f46e5" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
