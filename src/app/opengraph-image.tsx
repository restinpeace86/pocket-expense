import { ImageResponse } from "next/og";

// 링크 공유 미리보기 이미지(카카오톡·페이스북 등, 7차 개선사항 6). 빌드할 때 한 번 만든다.
// 서버 이미지 생성기에는 한글 글꼴이 없어, 쓰는 글자만 Google Fonts(Noto Sans KR)에서 받아 넣는다. 받지 못하면 영문 문구로 대신한다.
export const alt = "PocketExpense - 복잡한 경비처리, 사진 한 장으로 끝.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_1 = "복잡한 경비처리,";
const TITLE_2 = "사진 한 장으로 끝.";
const SUB = "영수증 등록부터 월말 세무회계용 엑셀 정리까지 한 번에";

async function koreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const font = await koreanFont(`${TITLE_1}${TITLE_2}${SUB}PocketExpense소기업·스타트업을 위한 AI 경비 정산`);
  const ko = !!font;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 88px", background: "linear-gradient(135deg, #09090b 0%, #0f172a 60%, #1e1b4b 100%)", color: "white", fontFamily: ko ? "NotoSansKR" : "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800 }}>P</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>PocketExpense</div>
        </div>
        {/* 이미지 생성기(satori)는 여러 자식을 가진 상자마다 display:flex가 필요하다 — 문구 묶음을 세로 상자로 감싼다 */}
        {ko ? (
          <div style={{ marginTop: 44, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.15, letterSpacing: -2 }}>{TITLE_1}</div>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.15, letterSpacing: -2 }}>
              <span style={{ color: "#60a5fa" }}>사진 한 장</span>
              <span>으로 끝.</span>
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#d4d4d8" }}>{SUB}</div>
          </div>
        ) : (
          <div style={{ marginTop: 44, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.15 }}>Snap a receipt.</div>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.15, color: "#60a5fa" }}>Expense report done.</div>
          </div>
        )}
      </div>
    ),
    { ...size, ...(font ? { fonts: [{ name: "NotoSansKR", data: font, weight: 800 as const, style: "normal" as const }] } : {}) },
  );
}
