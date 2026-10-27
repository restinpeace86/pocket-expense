"use client";

import { Brain, Check, FileSpreadsheet, RotateCcw, ScanLine, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 랜딩 "AI 영수증 분석 1분 미리보기" (7차 개선사항 10, D-131)
// 예시 영수증 1장 → AI(비전 LLM)가 읽는 과정 → 세무사무소 제출용 엑셀 한 줄. 실제 분석이 아니라 화면 안에서 흉내 내는 시연이다(서버 호출·크레딧 사용 없음).
// 화면에 보이면 한 번 자동으로 진행하고, 단계 버튼을 눌러 직접 볼 수 있다. 움직임 줄이기 설정이면 애니메이션 없이 바로 보여 준다.
type Step = 0 | 1 | 2;
const STEPS: { title: string; sub: string; icon: typeof Upload }[] = [
  { title: "영수증 업로드", sub: "현장에서 대충 찍은 사진", icon: Upload },
  { title: "AI LLM 분석", sub: "품목·부가세·거래 맥락까지", icon: Brain },
  { title: "엑셀 한 줄 완성", sub: "세무사무소 제출용", icon: FileSpreadsheet },
];
const LOGS = [
  "🧠 LLM 비전 모델이 영수증의 상호명, 품목, 공급가액, 부가세 및 거래 맥락을 분석 중입니다...",
  "상호명 읽음: 한빛철물건재 (구겨진 글자 보정)",
  "품목 3개 · 합계 47,300원 → 공급가액 43,000원 + 부가세 4,300원",
  "거래 맥락: 현장 자재 구매 → 계정과목 '소모품비' 추천",
];
const FIELDS: [string, string][] = [
  ["사용일자", "2026-10-24"],
  ["가맹점", "한빛철물건재"],
  ["사업자번호", "214-81-*****"],
  ["증빙", "카드 영수증"],
  ["공급가액", "43,000"],
  ["부가세", "4,300"],
  ["합계", "47,300"],
  ["계정과목", "소모품비"],
];

export function AiSimulator({ startHref }: { startHref: string }) {
  const [step, setStep] = useState<Step>(0);
  const [logs, setLogs] = useState(0); // 2단계에서 보인 로그 줄 수
  const [auto, setAuto] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // 처음부터 한 번 진행: 업로드(1.2초) → 분석 로그 4줄(줄마다 0.9초) → 엑셀 행
  const play = () => {
    clear();
    if (reduced.current) {
      setStep(2);
      setLogs(LOGS.length);
      return;
    }
    setAuto(true);
    setStep(0);
    setLogs(0);
    later(1200, () => setStep(1));
    LOGS.forEach((_, i) => later(1500 + i * 900, () => setLogs(i + 1)));
    later(1500 + LOGS.length * 900 + 500, () => {
      setStep(2);
      setAuto(false);
    });
  };

  const go = (s: Step) => {
    clear();
    setAuto(false);
    setStep(s);
    setLogs(s === 0 ? 0 : LOGS.length);
  };

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
    // 처음 한 번만 연결
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="ai-sim-title">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-sm font-medium text-violet-200">
          <ScanLine className="size-4" />
          단순 OCR이 아닌 AI LLM
        </span>
        <h2 id="ai-sim-title" className="mx-auto mt-4 max-w-2xl text-balance break-keep text-3xl font-bold tracking-tight sm:text-4xl">
          {/* "AI LLM"은 줄이 바뀌어도 떨어지지 않게 붙여 쓴다 */}
          오타 투성이 구겨진 영수증도, AI{"\u00a0"}LLM이 척척 정리하는 10초 컷 매직
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-balance break-keep text-zinc-400">글자만 베끼지 않고 품목·부가세·거래 맥락까지 스스로 파악해 계정과목까지 정리해요. 아래 단계를 눌러 직접 확인해 보세요.</p>
      </div>

      {/* 단계 버튼 — 휴대폰은 3칸 한 줄(설명은 sm부터) */}
      <ol className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map(({ title, sub, icon: Icon }, i) => {
          const on = step === i;
          const done = step > i;
          return (
            <li key={title}>
              <button
                type="button"
                onClick={() => go(i as Step)}
                aria-pressed={on}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-center transition sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left ${on ? "border-blue-400/60 bg-blue-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : on ? "bg-blue-500 text-white" : "bg-white/10 text-zinc-300"}`}>
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block break-keep text-xs font-semibold leading-tight sm:text-sm">
                    <span className="hidden sm:inline">Step {i + 1}. </span>
                    {title}
                  </span>
                  <span className="hidden text-xs text-zinc-400 sm:block">{sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div ref={box} className="mx-auto mt-6 grid max-w-3xl gap-4 rounded-3xl border border-white/10 bg-zinc-950/60 p-4 shadow-2xl shadow-violet-950/40 sm:p-6 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:items-start">
        {/* 예시 영수증(구겨진 철물점 영수증) */}
        <div className="relative mx-auto w-full max-w-[13rem]">
          <div
            className="relative -rotate-2 overflow-hidden rounded-md bg-[linear-gradient(170deg,#fdfcf7_0%,#f1eee4_45%,#fbf9f2_55%,#ebe7dc_100%)] px-4 pb-5 pt-4 font-mono text-[11px] leading-relaxed text-zinc-700 shadow-lg shadow-black/40"
            aria-label="예시 영수증: 한빛철물건재, 2026-10-24, 합계 47,300원"
            role="img"
          >
            <p className="text-center text-sm font-bold tracking-tight text-zinc-800">한빛철물건재</p>
            <p className="text-center text-[10px] text-zinc-500">214-81-***** · 경기 성남시</p>
            <p className="mt-2 border-t border-dashed border-zinc-400 pt-1.5">2026-10-24 14:12</p>
            <ul className="mt-1">
              <li className="flex justify-between"><span>앵카볼트 M8×20</span><span>18,000</span></li>
              <li className="flex justify-between"><span>실리콘(투명)×4</span><span>14,800</span></li>
              <li className="flex justify-between"><span>목장갑 1묶</span><span>14,500</span></li>
            </ul>
            <p className="mt-1.5 flex justify-between border-t border-dashed border-zinc-400 pt-1.5 font-bold"><span>합 계</span><span>47,300</span></p>
            <p className="flex justify-between text-[10px] text-zinc-500"><span>부가세 포함</span><span>신용 ****-1234</span></p>
            {/* 구김 자국 */}
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(0,0,0,0.06)_40%,transparent_43%),linear-gradient(35deg,transparent_60%,rgba(0,0,0,0.05)_62%,transparent_65%)]" />
            {step === 1 && <span className="pointer-events-none absolute inset-x-0 h-10 animate-[pe-scan_1.6s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-blue-400/35 to-transparent" />}
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">예시 영수증</p>
        </div>

        {/* 오른쪽: 단계별 화면 */}
        <div className="min-w-0" aria-live="polite">
          {step === 0 && (
            <div className="flex h-full flex-col justify-center gap-3 rounded-2xl border border-dashed border-white/15 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Upload className="size-5 text-blue-300" />
                사진 한 장 올리는 중…
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full bg-blue-500 ${auto ? "animate-[pe-fill_1.2s_ease-out_forwards]" : "w-full"}`} />
              </div>
              <p className="break-keep text-sm text-zinc-400">구겨지고 기울어진 사진도 그대로 올리면 돼요. 화질은 자동으로 맞춰요.</p>
            </div>
          )}
          {step >= 1 && (
            <ul className="flex flex-col gap-2 font-mono text-[13px] leading-relaxed">
              {LOGS.slice(0, logs).map((l, i) => (
                <li key={l} className={`landing-row rounded-xl px-3 py-2 break-keep ${i === 0 ? "bg-violet-500/15 text-violet-100" : "bg-white/5 text-zinc-300"}`} style={{ animationDelay: "0s" }}>
                  {i > 0 && <Check className="mr-1.5 inline size-3.5 text-emerald-400" />}
                  {l}
                </li>
              ))}
              {step === 1 && logs < LOGS.length && <li className="px-3 text-zinc-500">▍</li>}
            </ul>
          )}
          {step === 2 && (
            <div className="landing-bubble mt-4 rounded-2xl bg-white p-4 text-zinc-900 shadow-xl" style={{ animationDelay: "0s" }}>
              <p className="flex items-center gap-2 font-bold">
                <FileSpreadsheet className="size-5 text-emerald-600" />
                세무사무실 제출용 엑셀 행(Row) 변환 완료! 🎉
              </p>
              {/* 휴대폰: 칸 이름·값 2열 표 / 넓은 화면: 엑셀 칸 모양 4칸 × 2줄(스크롤 없이 모두 보이게) */}
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:hidden">
                {FIELDS.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-zinc-500">{k}</dt>
                    <dd className="text-right font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-3 hidden grid-cols-4 border-l border-t border-zinc-200 text-xs sm:grid">
                {FIELDS.map(([k, v]) => (
                  <div key={k} className="min-w-0 border-b border-r border-zinc-200">
                    <dt className="bg-emerald-50 px-2 py-1.5 font-semibold">{k}</dt>
                    <dd className="truncate px-2 py-1.5 tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={play} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm text-zinc-600 hover:bg-zinc-100">
                <RotateCcw className="size-4" />
                처음부터 다시 보기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href={startHref} className="inline-flex min-h-14 max-w-full items-center justify-center rounded-xl bg-blue-500 px-6 text-center text-base font-semibold text-balance break-keep hover:bg-blue-400 sm:text-lg">
          내 현장 영수증으로 무료 체험하기 (100 크레딧 즉시 지급)
        </Link>
      </div>
    </section>
  );
}
