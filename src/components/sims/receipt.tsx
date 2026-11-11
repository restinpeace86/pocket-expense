import { Check, FileSpreadsheet, FileText, ScanLine, Sparkles } from "lucide-react";
import type { SimDef } from "./sim-player";
import { Btn, Duo, Field, Notice, Phone, Show } from "./ui";

// 영수증(지금 랜딩 시뮬레이션과 같은 내용, D-141): 찍고 AI 분석 → 결의서 칸 자동 채움·결재 올리기 → 알림 받고 승인 · 엑셀 한 줄
const READS: [string, string][] = [
  ["가맹점", "한빛철물건재 — 구겨진 글자 보정"],
  ["품목·금액", "앵카볼트 외 2건 · 47,300원"],
  ["부가세", "43,000원 + 4,300원 분리"],
  ["거래 맥락", "현장 자재 구매 → 소모품비"],
];

function Receipt({ scanning }: { scanning?: boolean }) {
  return (
    <div className="relative w-full max-w-[12rem] -rotate-2 overflow-hidden rounded-md bg-[linear-gradient(170deg,#fdfcf7_0%,#f1eee4_45%,#fbf9f2_55%,#ebe7dc_100%)] px-3 pb-4 pt-3 font-mono text-[10px] leading-relaxed text-zinc-700 shadow-lg ring-1 ring-zinc-300" role="img" aria-label="예시 영수증: 한빛철물건재, 합계 47,300원">
      <p className="text-center text-[12px] font-bold">한빛철물건재</p>
      <p className="mt-1.5 border-t border-dashed border-zinc-400 pt-1">2026-10-24 14:12</p>
      <p className="flex justify-between"><span>앵카볼트 M8×20</span><span>18,000</span></p>
      <p className="flex justify-between"><span>실리콘(투명)×4</span><span>14,800</span></p>
      <p className="flex justify-between"><span>목장갑 1묶</span><span>14,500</span></p>
      <p className="mt-1 flex justify-between border-t border-dashed border-zinc-400 pt-1 font-bold"><span>합 계</span><span>47,300</span></p>
      {scanning && <span className="pointer-events-none absolute inset-x-0 h-8 animate-[pe-scan_1.6s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-400/40 to-transparent" />}
    </div>
  );
}

export const receiptSim: SimDef = {
  key: "receipt",
  title: "영수증 → 결재 → 엑셀",
  steps: [
    { title: "찍고 AI 분석", who: "직원", icon: ScanLine, ticks: 5 },
    { title: "결의서 · 결재 올리기", who: "직원", icon: FileText, ticks: 5 },
    { title: "승인 · 엑셀 한 줄", who: "결재자", icon: FileSpreadsheet, ticks: 2 },
  ],
  tickMs: 700,
  scene: (step, t) => {
    if (step === 0)
      return (
        <Duo>
          <div className="pt-2">
            <Receipt scanning={t >= 1 && t < 5} />
          </div>
          <div className="flex w-full max-w-[17rem] flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-800">
              <Sparkles className="size-4" /> {t < 1 ? "사진 한 장 올리는 중…" : t < 5 ? "AI가 영수증을 읽는 중…" : "AI가 읽어 낸 것"}
            </p>
            {READS.slice(0, Math.max(0, t - 1 + (t >= 5 ? 1 : 0))).map(([k, v]) => (
              <div key={k} className="landing-row flex gap-2 rounded-xl bg-white px-3 py-2 text-[12px] shadow-sm" style={{ animationDelay: "0s" }}>
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 break-keep">
                  <b>{k}</b> <span className="text-zinc-600">{v}</span>
                </span>
              </div>
            ))}
          </div>
        </Duo>
      );
    if (step === 1)
      return (
        <Phone title="지출결의서">
          <p className="text-[11px] text-zinc-500">AI가 채웠어요 · 직원은 확인만</p>
          <Field k="가맹점" v="한빛철물건재" on={t >= 1} />
          <Field k="금액" v="47,300원" on={t >= 1} />
          <Field k="공급가액 / 부가세" v="43,000 / 4,300" on={t >= 2} tag="자동 분리" />
          <Field k="계정과목" v="소모품비" on={t >= 3} tag="AI 추천" />
          <Btn state={t >= 5 ? "done" : t >= 4 ? "ready" : "idle"} done="결재 올림">
            결재 올리기
          </Btn>
          <Show when={t >= 5}>
            <p className="text-center text-[11px] text-zinc-600">대표님께 결재 요청 알림을 보냈어요</p>
          </Show>
        </Phone>
      );
    return (
      <Phone title="결재자 휴대폰">
        <Notice title="결재 요청 알림" body="김현장님이 지출결의서를 올렸어요 · 47,300원" />
        <Show when={t >= 1}>
          <div className="rounded-xl border border-zinc-200 p-2.5">
            <p className="text-[11px] text-zinc-500">알림을 눌러 연 결재 화면</p>
            <p className="flex justify-between font-semibold">
              <span>현장 자재 구매</span>
              <span>47,300원</span>
            </p>
            <div className="mt-2">
              <Btn state={t >= 2 ? "done" : "ready"} done="승인 완료">
                승인
              </Btn>
            </div>
          </div>
        </Show>
        <Show when={t >= 2}>
          <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800">
            <FileSpreadsheet className="size-4" /> 세무사무소 제출용 엑셀에 한 줄 추가
          </p>
        </Show>
      </Phone>
    );
  },
};
