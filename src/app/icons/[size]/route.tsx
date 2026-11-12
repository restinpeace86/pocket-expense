import { ImageResponse } from "next/og";
import { markSvg } from "@/components/brand/mark-svg";
import { BRAND } from "@/lib/brand";

// 앱 아이콘(홈 화면 추가·알림 아이콘, D-116). 크기: 96 / 180 / 192 / 512
const SIZES = new Set([96, 180, 192, 512]);
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.color.main} 0%, ${BRAND.color.deep} 100%)` }}>
        {/* 모이는 M(D-252 로고) — 마스크 아이콘 안전 영역(가운데 80%) 안에 */}
        {markSvg({ size: size * 0.56, color: "white" })}
      </div>
    ),
    { width: size, height: size },
  );
}
