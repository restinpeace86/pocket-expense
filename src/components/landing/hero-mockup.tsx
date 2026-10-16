// 히어로 목업 애니메이션 (spec/screens/landing-page.md §3). 소개 동영상이 준비되면 교체할 수 있다.
// 영수증 여러 장 촬영 → 소명서 표 자동 입력 → 대표 카카오톡 결재 요청 → [전체 승인]
const ROWS = [
  { place: "코레일(KTX)", amount: "50,000원", tag: "대중교통" },
  { place: "한국도로공사", amount: "5,000원", tag: "통행료" },
  { place: "부산국밥", amount: "17,000원", tag: "출장 식비" },
];

export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div className="rounded-[2rem] border border-white/15 bg-zinc-950/80 p-4 shadow-2xl shadow-blue-900/40 backdrop-blur">
        <div className="rounded-2xl bg-white p-4 text-zinc-900">
          <p className="text-xs text-zinc-500">지출소명서</p>
          <p className="font-semibold">10/15 부산 출장</p>
          <ul className="mt-3 flex flex-col gap-2">
            {ROWS.map((row, i) => (
              <li
                key={row.place}
                className="landing-row flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm"
                style={{ animationDelay: `${0.6 + i * 0.7}s` }}
              >
                <span>
                  {row.place}
                  <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{row.tag}</span>
                </span>
                <span className="font-medium">{row.amount}</span>
              </li>
            ))}
          </ul>
          <p className="landing-row mt-3 text-right text-sm font-semibold" style={{ animationDelay: "2.8s" }}>
            3건 · 72,000원
          </p>
        </div>
      </div>
      <div
        className="landing-bubble absolute -bottom-10 -right-2 w-60 rounded-2xl bg-[#FEE500] p-3 text-sm text-black/85 shadow-xl sm:-right-10"
        style={{ animationDelay: "3.6s" }}
      >
        <p className="font-semibold">[PocketExpense] 결재 요청</p>
        <p className="mt-1">김개발님 · 부산 출장 3건 · 72,000원</p>
        <p className="mt-2 rounded-lg bg-black/80 py-1.5 text-center text-white">전체 승인</p>
      </div>
    </div>
  );
}
