import { ImageResponse } from "next/og";

// 카카오톡 공유 카드 이미지 (개선사항 1-2). 서버 이미지 생성기에 한글 글꼴이 없어 글자는 영문만 넣고,
// 한글 제목·설명은 카카오 카드의 글 영역에 넣는다.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ width: 120, height: 120, borderRadius: 28, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="84" height="84" viewBox="0 0 44 44"><path d="M8 34V14l14 12 14-12v20" fill="none" stroke="#4f46e5" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="8" r="4" fill="#4f46e5" /></svg></div>
        <div style={{ marginTop: 28, fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>Moa-on</div>
        <div style={{ marginTop: 10, fontSize: 28, opacity: 0.85 }}>Receipts in, expense reports done.</div>
      </div>
    ),
    { width: 800, height: 400 },
  );
}
