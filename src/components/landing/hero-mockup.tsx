"use client";

import { useRef } from "react";
import { useSeen } from "./use-seen";
import { BRAND } from "@/lib/brand";

// 히어로 목업 애니메이션 (spec/screens/landing-page.md §3). 소개 동영상이 준비되면 교체할 수 있다.
// 사람이 보고 있을 때만 재생하고(useSeen, D-182), 벗어나거나 다른 탭으로 가면 멈췄다가 다시 보이면 이어서 재생한다(휴대폰은 목업이 첫 화면 아래에 있음)
// 영수증 여러 장 촬영 → 결의서 표 자동 입력 → 대표에게 카카오톡 알림톡 결재 요청 → [결재하러 가기]로 연 결재 화면에서 [전체 승인]
// 알림톡은 승인하라는 알림이고, 승인은 열린 결재 화면에서 한다(D-013). 알림톡은 오픈 전에 연결한다는 전제(D-142)
// 색 보완(9-15, D-263): 구역색 태그 + 떠 있는 결과 카드 3개(경비 인디고·근태 청록·세무 분홍)는 처음부터 보인다
const ROWS = [
  { place: "코레일(KTX)", amount: "50,000원", tag: "대중교통", cls: "bg-indigo-50 text-indigo-700" },
  { place: "한국도로공사", amount: "5,000원", tag: "통행료", cls: "bg-sky-50 text-sky-700" },
  { place: "부산국밥", amount: "17,000원", tag: "출장 식비", cls: "bg-amber-50 text-amber-800" },
];

const CHIPS = [
  // 넓은 화면: 휴대폰 화면 글자를 가리지 않게 위 테두리·아래 바깥에 둔다
  { mark: "✦", text: "영수증 3장 → 결의서 자동 채움", dot: "bg-indigo-600", pos: "lg:-left-8 lg:-top-8" },
  { mark: "✓", text: "QR 출근 09:02", dot: "bg-teal-600", pos: "lg:-left-6 lg:top-[calc(100%+1rem)]" },
  { mark: "→", text: "세무사무소로 월말 전달", dot: "bg-pink-600", pos: "lg:-right-6 lg:-top-8" },
];

export function HeroMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const playing = useSeen(ref);
  return (
    <div ref={ref} data-playing={playing ? "true" : "false"} className="landing-anim relative mx-auto w-full max-w-sm lg:mb-48" aria-hidden>
      <div className="rounded-[2rem] bg-[#14142b] p-3 shadow-2xl shadow-indigo-900/40">
        <div className="rounded-[1.4rem] bg-white p-4 text-zinc-900">
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
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${row.cls}`}>{row.tag}</span>
                </span>
                <span className="shrink-0 pl-2 font-medium">{row.amount}</span>
              </li>
            ))}
          </ul>
          <p className="landing-row mt-3 text-right text-sm font-semibold" style={{ animationDelay: "2.8s" }}>
            3건 · 72,000원
          </p>
          <p className="mt-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2 text-center text-sm font-bold text-white">결재 올리기</p>
        </div>
      </div>
      {/* 결과 카드: 휴대폰·태블릿은 휴대폰 아래 한 줄씩, 넓은 화면(lg)은 휴대폰 둘레에 떠 있음 */}
      <ul className="mt-4 flex flex-wrap justify-center gap-2 lg:mt-0">
        {CHIPS.map((c) => (
          <li key={c.text} className={`flex items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-lg shadow-indigo-900/10 ring-1 ring-zinc-900/5 lg:absolute ${c.pos}`} data-hero-chip>
            <span className={`flex size-6 items-center justify-center rounded-lg text-xs text-white ${c.dot}`}>{c.mark}</span>
            {c.text}
          </li>
        ))}
      </ul>
      {/* 모바일·태블릿: 카드 아래에 배치 / 넓은 화면(lg): 카드 오른쪽 아래에 겹쳐 배치 — 화면 밖으로 나가지 않게 */}
      <div className="ml-auto mt-4 flex w-full max-w-64 flex-col gap-2 lg:absolute lg:-bottom-44 lg:-right-8 lg:mt-0 lg:w-64">
        <div className="landing-bubble rounded-2xl bg-[#FEE500] p-3 text-sm text-black/85 shadow-xl" style={{ animationDelay: "3.6s" }}>
          <p className="text-[11px] text-black/60">카카오톡 알림톡</p>
          <p className="font-semibold">[{BRAND.name}] 결재 요청</p>
          <p className="mt-1">김개발님 · 부산 출장 3건 · 72,000원</p>
          <p className="mt-2 rounded-lg bg-white py-1.5 text-center text-black/85">결재하러 가기</p>
        </div>
        <div className="landing-bubble flex items-center justify-between gap-2 rounded-2xl bg-white p-2 pl-3 text-sm text-zinc-900 shadow-xl" style={{ animationDelay: "4.6s" }}>
          <span className="min-w-0 text-xs text-zinc-500">결재 화면</span>
          <span className="shrink-0 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 font-semibold text-white">전체 승인 ✓</span>
        </div>
      </div>
    </div>
  );
}
