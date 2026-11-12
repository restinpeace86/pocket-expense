// "다른 점" 카드 안 작은 화면 그림(9-15, D-263) — 사진·외부 이미지 없이 실제 화면 조각을 HTML로 그린다(가볍게).
// 꾸밈 그림이라 화면 읽기 프로그램에는 숨긴다
export type WhyArt = "bundle" | "ai" | "form" | "tax";

const box = "flex w-full flex-col gap-1.5 rounded-2xl bg-white p-3 text-[11px] text-zinc-700 shadow-lg shadow-zinc-900/10 lg:w-44";
const row = "flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2 py-1.5";

export function WhyArtwork({ art }: { art: WhyArt }) {
  if (art === "bundle")
    return (
      <div className={box} aria-hidden>
        <span className="flex flex-wrap gap-1">
          {[
            ["경비", "bg-indigo-50 text-indigo-700"],
            ["근태", "bg-teal-50 text-teal-700"],
            ["채팅", "bg-amber-50 text-amber-800"],
            ["서류", "bg-sky-50 text-sky-700"],
            ["세무", "bg-pink-50 text-pink-700"],
          ].map(([t, c]) => (
            <span key={t} className={`rounded-md px-1.5 py-0.5 font-semibold ${c}`}>
              {t}
            </span>
          ))}
        </span>
        <span className="text-center font-bold text-teal-600">↓</span>
        <span className="rounded-lg bg-teal-600 px-2 py-1.5 text-center font-bold text-white">구독 1개</span>
      </div>
    );
  if (art === "ai")
    return (
      <div className={box} aria-hidden>
        <span className={row}>
          <span>🧾 카페 영수증</span>
          <b>6,500</b>
        </span>
        <span className="text-center font-bold text-indigo-600">↓ AI</span>
        <span className={`${row} bg-indigo-50`}>
          <span>회의비</span>
          <span className="rounded bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">자동</span>
        </span>
      </div>
    );
  if (art === "form")
    return (
      <div className={box} aria-hidden>
        <span className="font-semibold">휴가신청서.xlsx</span>
        <span className="grid grid-cols-3 gap-[3px]">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`h-3 rounded-[3px] ${i < 3 ? "bg-sky-600/80" : "bg-sky-100"}`} />
          ))}
        </span>
        <span className="flex gap-1">
          <span className="rounded bg-sky-50 px-1.5 font-semibold text-sky-700">PDF</span>
          <span className="rounded bg-sky-50 px-1.5 font-semibold text-sky-700">엑셀</span>
        </span>
      </div>
    );
  return (
    <div className={box} aria-hidden>
      <span className="font-semibold">11월 마감 파일</span>
      <span className={row}>
        <span>장부·영수증·결의서</span>
        <b>3</b>
      </span>
      <span className="rounded-lg bg-pink-600 px-2 py-1.5 text-center font-bold text-white">→ 세무사무소</span>
    </div>
  );
}
