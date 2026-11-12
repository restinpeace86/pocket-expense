import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { markSvg } from "@/components/brand/mark-svg";

// 브라우저 탭 아이콘(D-252): 브랜드 색 바탕 + 흰 M(모이는 M)
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.color.main, borderRadius: 7 }}>
        {markSvg({ size: 24, color: "white", weight: 1.1 })}
      </div>
    ),
    size,
  );
}
