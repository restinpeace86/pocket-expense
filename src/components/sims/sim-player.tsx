"use client";

import { Check, RotateCcw, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSeen } from "@/components/landing/use-seen";

// 기능 시뮬레이션 공용 틀(D-255 §B): 랜딩 [기능 미리 보기]와 도움말 [▶ 화면으로 보기]가 같이 쓴다.
// 화면 안 시연(서버 호출·실제 기록 없음). 보이면 한 번 자동 재생(useSeen, D-182), 단계 버튼으로 그 단계만 다시, 움직임 줄이기면 끝 모습.
// 단계마다 장면이 tick 0 → ticks까지 한 칸씩 드러난다(tickMs 간격). 단계 끝에서 HOLD만큼 머문다.
export type SimStep = { title: string; who: string; icon: LucideIcon; ticks: number };
export type SimDef = {
  key: string;
  title: string;
  steps: SimStep[];
  tickMs?: number;
  scene: (step: number, tick: number) => ReactNode;
};

const HOLD = 1600;

// playNow: 사람이 직접 [▶ 화면으로 보기]를 눌렀을 때(도움말) — 보이기를 기다리지 않고 바로 재생하고 화면 안으로 끌어온다
export function SimPlayer({ def, tone = "light", autoPlay = true, playNow = false }: { def: SimDef; tone?: "light" | "dark"; autoPlay?: boolean; playNow?: boolean }) {
  const tickMs = def.tickMs ?? 900;
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const [over, setOver] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);
  const playing = useRef(false);
  const seen = useRef(false);
  const dur = (s: number) => def.steps[s].ticks * tickMs + HOLD;

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const end = (s: number) => {
    setStep(s);
    setTick(def.steps[s].ticks);
  };
  const playStep = (s: number, offset: number) => {
    later(offset, () => {
      setStep(s);
      setTick(0);
    });
    for (let i = 1; i <= def.steps[s].ticks; i++) later(offset + i * tickMs, () => setTick(i));
  };
  const play = () => {
    clear();
    setOver(false);
    if (reduced.current) {
      end(def.steps.length - 1);
      setOver(true);
      seen.current = true;
      return;
    }
    playing.current = true;
    let t = 0;
    def.steps.forEach((_, s) => {
      playStep(s, t);
      t += dur(s);
    });
    later(t - HOLD + 300, () => {
      playing.current = false;
      seen.current = true;
      setOver(true);
    });
  };
  const go = (s: number) => {
    clear();
    playing.current = false;
    seen.current = true;
    if (reduced.current) return end(s);
    setOver(false);
    playStep(s, 0);
    later(dur(s) - HOLD + 300, () => s === def.steps.length - 1 && setOver(true));
  };
  const reset = () => {
    clear();
    playing.current = false;
    setStep(0);
    setTick(0);
    setOver(false);
  };

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (playNow) {
      box.current?.scrollIntoView({ block: "nearest", behavior: reduced.current ? "auto" : "smooth" });
      later(0, play);
    } else if (reduced.current) end(0);
    return clear;
    // 처음 한 번만(end는 setter만 씀)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 보는 동안 한 번 자동 재생, 끝나기 전에 벗어나면 처음 모습으로
  const active = useSeen(box);
  useEffect(() => {
    if (!autoPlay || playNow) return;
    if (active && !playing.current && !seen.current) play();
    else if (!active && playing.current) reset();
    // play·reset은 ref·setter만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, autoPlay, playNow]);

  const dark = tone === "dark";
  return (
    <div className="flex w-full flex-col gap-3" data-sim={def.key} data-sim-step={step} data-sim-over={over ? "" : undefined}>
      <ol className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${def.steps.length}, minmax(0, 1fr))` }}>
        {def.steps.map(({ title, who, icon: Icon }, i) => {
          const on = step === i;
          const done = step > i || (over && i === def.steps.length - 1);
          return (
            <li key={title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-pressed={on}
                data-sim-go={i}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition sm:flex-row sm:justify-start sm:gap-2.5 sm:px-3 sm:text-left ${
                  on ? (dark ? "border-blue-400/60 bg-blue-500/15" : "border-brand-400 bg-brand-50") : dark ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : on ? (dark ? "bg-blue-500 text-white" : "bg-brand-600 text-white") : dark ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-500"}`}>
                  {done ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className={`block break-keep text-[12px] font-semibold leading-tight sm:text-[13px] ${dark ? "text-white" : "text-zinc-900"}`}>{title}</span>
                  <span className={`hidden text-[11px] sm:block ${dark ? "text-zinc-400" : "text-zinc-500"}`}>{who}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div ref={box} className={`relative min-h-[22rem] overflow-hidden rounded-3xl p-3 sm:p-5 ${dark ? "bg-zinc-100 shadow-2xl shadow-black/40" : "border border-zinc-200 bg-zinc-100"}`} aria-live="polite" aria-label={`${def.title} 시연 화면`}>
        {def.scene(step, tick)}
      </div>
      <div className={`flex flex-wrap items-center justify-between gap-2 text-[12px] ${dark ? "text-zinc-400" : "text-zinc-500"}`}>
        <span>화면 안 시연이에요 · 실제 기록은 남지 않아요</span>
        <button type="button" onClick={play} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium ${dark ? "text-zinc-200 hover:bg-white/10" : "text-zinc-700 hover:bg-zinc-200/60"}`} data-sim-replay>
          <RotateCcw className="size-4" aria-hidden /> 처음부터 다시 보기
        </button>
      </div>
    </div>
  );
}
