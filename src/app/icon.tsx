import { ImageResponse } from "next/og";

// 브라우저 탭 아이콘(D-252): 브랜드 색 바탕 + 흰 M(모이는 M)
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#4f46e5", borderRadius: 7 }}>
        <svg width="24" height="24" viewBox="0 0 44 44"><path d="M8 34V14l14 12 14-12v20" fill="none" stroke="white" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="8" r="4.5" fill="white" /></svg>
      </div>
    ),
    size,
  );
}
