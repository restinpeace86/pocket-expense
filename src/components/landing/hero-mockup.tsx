"use client";

import { useEffect, useRef, useState } from "react";

// 히어로 목업 애니메이션 (spec/screens/landing-page.md §3). 소개 동영상이 준비되면 교체할 수 있다.
// 화면에 들어왔을 때만 재생하고, 벗어나면 멈췄다가 다시 보이면 이어서 재생한다(PC·휴대폰 모두 — 휴대폰은 목업이 첫 화면 아래에 있음)
// 영수증 여러 장 촬영 → 결의서 표 자동 입력 → 대표에게 카카오톡 알림톡 결재 요청 → [결재하러 가기]로 연 결재 화면에서 [전체 승인]
// 알림톡은 승인하라는 알림이고, 승인은 열린 결재 화면에서 한다(D-013). 알림톡은 오픈 전에 연결한다는 전제(D-142)
const ROWS = [
  { place: "코레일(KTX)", amount: "50,000원", tag: "대중교통" },
  { place: "한국도로공사", amount: "5,000원", tag: "통행료" },
  { place: "부산국밥", amount: "17,000원", tag: "출장 식비" },
];

export function HeroMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setPlaying(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setPlaying(entries.some((e) => e.isIntersecting)), { rootMargin: "-20% 0px -20% 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-playing={playing ? "true" : "false"} className="landing-anim relative mx-auto w-full max-w-sm lg:mb-48" aria-hidden>
      <div className="rounded-[2rem] border border-white/15 bg-zinc-950/80 p-4 shadow-2xl shadow-blue-900/40 backdrop-blur">
        <div className="rounded-2xl bg-white p-4 text-zinc-900">
          <p className="text-xs text-zinc-500">지출결의서</p>
          <p className="font-semibold">10/15 부산 출장</p>
          <ul className="mt-3 flex flex-col gap-2">
            {ROWS.map((row, i) => (
              <li
                key={row.place}
                className="landing-row flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm"
                style={{ animationDelay: `${0.6 + i * 0.7}s` }}
              >
                <span className="min-w-0 truncate">
                  {row.place}
                  <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{row.tag}</span>
                </span>
                <span className="shrink-0 pl-2 font-medium">{row.amount}</span>
              </li>
            ))}
          </ul>
          <p className="landing-row mt-3 text-right text-sm font-semibold" style={{ animationDelay: "2.8s" }}>
            3건 · 72,000원
          </p>
        </div>
      </div>
      {/* 모바일·태블릿: 카드 아래에 배치 / 넓은 화면(lg): 카드 오른쪽 아래에 겹쳐 배치 — 화면 밖으로 나가지 않게 */}
      <div className="ml-auto mt-4 flex w-full max-w-64 flex-col gap-2 lg:absolute lg:-bottom-44 lg:-right-8 lg:mt-0 lg:w-64">
        <div className="landing-bubble rounded-2xl bg-[#FEE500] p-3 text-sm text-black/85 shadow-xl" style={{ animationDelay: "3.6s" }}>
          <p className="text-[11px] text-black/60">카카오톡 알림톡</p>
          <p className="font-semibold">[PocketExpense] 결재 요청</p>
          <p className="mt-1">김개발님 · 부산 출장 3건 · 72,000원</p>
          <p className="mt-2 rounded-lg bg-white py-1.5 text-center text-black/85">결재하러 가기</p>
        </div>
        <div className="landing-bubble flex items-center justify-between gap-2 rounded-2xl bg-white p-2 pl-3 text-sm text-zinc-900 shadow-xl" style={{ animationDelay: "4.6s" }}>
          <span className="min-w-0 text-xs text-zinc-500">결재 화면</span>
          <span className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white">전체 승인 ✓</span>
        </div>
      </div>
    </div>
  );
}
