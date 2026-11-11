import { Camera, Check, FileDown, FileSpreadsheet, PencilLine, Sparkles, Table2 } from "lucide-react";
import type { SimDef } from "./sim-player";
import { Duo, Panel, Say, Show } from "./ui";

// ③ 서류 → 엑셀: 종이 표 사진 → AI가 표 모양 그대로(합친 칸·굵은 글씨) → 글자 고치기 → [엑셀 받기]·PDF
const ROWS: [string, string, string, string][] = [
  ["11/03", "A동 배관 교체", "3", "1,200,000"],
  ["11/05", "B동 도장", "2", "850,000"],
  ["11/07", "C동 방수", "1", "420,000"],
];

function Paper({ scanning }: { scanning?: boolean }) {
  return (
    <div className="relative w-full max-w-[14rem] -rotate-2 overflow-hidden rounded-sm bg-[linear-gradient(170deg,#fdfcf7_0%,#efece2_60%,#f8f6ee_100%)] p-3 font-mono text-[9.5px] text-zinc-700 shadow-lg ring-1 ring-zinc-300" role="img" aria-label="예시 종이 표: 11월 공사 내역">
      <p className="text-center text-[11px] font-bold">11월 공사 내역</p>
      <div className="mt-1.5 grid grid-cols-[2.6rem_1fr_1.2rem_3.6rem] border-l border-t border-zinc-500">
        {["날짜", "내용", "인", "금액"].map((h) => (
          <span key={h} className="border-b border-r border-zinc-500 px-0.5 font-bold">{h}</span>
        ))}
        {ROWS.flat().map((c, i) => (
          <span key={i} className="truncate border-b border-r border-zinc-500 px-0.5">{i === 3 ? "1,2O0,000" : c}</span>
        ))}
        <span className="col-span-3 border-b border-r border-zinc-500 px-0.5 text-center font-bold">합 계</span>
        <span className="border-b border-r border-zinc-500 px-0.5 font-bold">2,470,000</span>
      </div>
      {scanning && <span className="pointer-events-none absolute inset-x-0 h-8 animate-[pe-scan_1.5s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-400/40 to-transparent" />}
    </div>
  );
}

export const convertSim: SimDef = {
  key: "convert",
  title: "서류 → 엑셀",
  steps: [
    { title: "사진 올리기", who: "누구나", icon: Camera, ticks: 2 },
    { title: "AI가 표로", who: "표 모양 그대로", icon: Table2, ticks: 5 },
    { title: "고치고 받기", who: "엑셀 · PDF", icon: FileSpreadsheet, ticks: 3 },
  ],
  tickMs: 750,
  scene: (step, t) => {
    if (step === 0)
      return (
        <div className="flex flex-col items-center gap-4 pt-2">
          <Paper />
          <div className="w-full max-w-[16rem] rounded-2xl border border-dashed border-zinc-300 bg-white p-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              {t >= 2 ? <Check className="size-4 text-emerald-500" /> : <Camera className="size-4 text-brand-600" />}
              {t >= 2 ? "사진 올리기 완료" : "종이 표 사진 올리는 중…"}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className={`h-full rounded-full bg-brand-500 ${t >= 2 ? "w-full" : "animate-[pe-fill_1.5s_ease-out_forwards]"}`} />
            </div>
          </div>
          <Say>채팅에 올린 사진을 길게 눌러 바로 바꿀 수도 있어요</Say>
        </div>
      );
    const fixed = step === 2 && t >= 1;
    const cell = (v: string, r: number, c: number) => {
      const bad = r === 0 && c === 3;
      const val = bad ? (fixed ? "1,200,000" : "1,2O0,000") : v;
      return (
        <span key={`${r}-${c}`} className={`truncate border-b border-r border-zinc-200 px-1 py-1 ${c === 3 ? "text-right tabular-nums" : ""} ${bad && step === 2 ? (fixed ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : "bg-amber-50 ring-2 ring-inset ring-amber-400") : ""}`}>
          {val}
        </span>
      );
    };
    return (
      <Duo>
        <div className="hidden sm:block sm:pt-4">
          <Paper scanning={step === 1 && t < 5} />
        </div>
        <Panel title="엑셀로 바꾼 표" sub="표 모양 그대로" className="max-w-[20rem]">
          {step === 1 && (
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-700">
              <Sparkles className="size-3.5" /> {t < 5 ? "AI가 칸·합친 칸·굵은 글씨를 읽는 중…" : "다 바꿨어요 · 원본과 나란히 확인해요"}
            </p>
          )}
          <div className="grid grid-cols-[3rem_1fr_1.6rem_5rem] border-l border-t border-zinc-200 text-[11px]">
            {(step === 2 || t >= 1) &&
              ["날짜", "내용", "인", "금액"].map((h) => (
                <span key={h} className="landing-row border-b border-r border-zinc-200 bg-emerald-50 px-1 py-1 font-bold" style={{ animationDelay: "0s" }}>
                  {h}
                </span>
              ))}
            {ROWS.map((row, r) => (step === 2 || t >= r + 2 ? row.map((v, c) => cell(v, r, c)) : null))}
            {(step === 2 || t >= 5) && (
              <>
                <span className="col-span-3 border-b border-r border-zinc-200 px-1 py-1 text-center font-bold">합 계</span>
                <span className="border-b border-r border-zinc-200 px-1 py-1 text-right font-bold tabular-nums">2,470,000</span>
              </>
            )}
          </div>
          {step === 2 && (
            <>
              <p className="flex items-center gap-1.5 text-[11.5px] text-zinc-600">
                <PencilLine className="size-3.5 text-amber-600" />
                {fixed ? "잘못 읽은 글자(O → 0)를 눌러서 고쳤어요" : "이상한 칸은 눌러서 글자를 고쳐요"}
              </p>
              <Show when={t >= 2} className="grid grid-cols-2 gap-2">
                <span className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-white ${t >= 3 ? "bg-emerald-500" : "bg-brand-600 ring-4 ring-brand-200"}`}>
                  {t >= 3 ? <Check className="size-4" /> : <FileSpreadsheet className="size-4" />} {t >= 3 ? "받았어요" : "엑셀 받기"}
                </span>
                <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 text-[13px] font-semibold">
                  <FileDown className="size-4" /> PDF 받기
                </span>
              </Show>
              <Show when={t >= 3}>
                <Say>더 손볼 건 받은 엑셀에서 이어서 해요</Say>
              </Show>
            </>
          )}
        </Panel>
      </Duo>
    );
  },
};
