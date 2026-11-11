import { ImageResponse } from "next/og";

// 브라우저 탭 아이콘(D-221): 브랜드 색 바탕 + 흰 켜진 스위치(Moa-on 로고의 O)
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#4f46e5", borderRadius: 7 }}>
        <div style={{ width: 22, height: 13, borderRadius: 99, background: "white", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: 2 }}>
          <div style={{ width: 9, height: 9, borderRadius: 99, background: "#4f46e5" }} />
        </div>
      </div>
    ),
    size,
  );
}
