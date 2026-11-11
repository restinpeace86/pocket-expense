import { Building2, Check, CreditCard, FileArchive, FileSpreadsheet, FileText, ListChecks } from "lucide-react";
import type { SimDef } from "./sim-player";
import { Duo, Panel, Say, Show } from "./ui";

// ⑥ 월말 마감: 이번 달 승인된 지출 → 카드 내역 대조(빠진 영수증) → 마감(장부 엑셀·영수증·결의서 PDF) → 세무사무소 전용 화면에서 바로 받음
const ROWS: [string, string, string][] = [
  ["11/03", "한빛철물건재", "47,300"],
  ["11/07", "부산 출장", "186,000"],
  ["11/12", "거래처 미팅 식대", "48,000"],
  ["11/21", "사무용품", "23,900"],
];
const FILES: { icon: typeof FileText; name: string; note: string; cls: string }[] = [
  { icon: FileSpreadsheet, name: "장부(엑셀)", note: "계정과목·공급가액·부가세", cls: "text-emerald-600" },
  { icon: FileArchive, name: "영수증·증빙 파일", note: "증빙번호 순으로", cls: "text-amber-600" },
  { icon: FileText, name: "지출결의서 PDF", note: "결재란까지", cls: "text-red-500" },
];

export const closingSim: SimDef = {
  key: "closing",
  title: "월말 마감",
  steps: [
    { title: "승인된 지출 · 대조", who: "경리", icon: ListChecks, ticks: 3 },
    { title: "마감 파일", who: "한 번에", icon: FileArchive, ticks: 4 },
    { title: "세무사무소", who: "전용 화면", icon: Building2, ticks: 2 },
  ],
  tickMs: 850,
  scene: (step, t) => {
    if (step === 0)
      return (
        <Panel title="세무 마감 · 11월" sub="🟡 마감 대기" className="mx-auto max-w-[24rem]">
          <p className="text-[11px] font-semibold text-zinc-600">승인 완료된 지출 31건 · 1,284,500원</p>
          <div className="flex flex-col divide-y divide-zinc-100">
            {ROWS.map(([d, n, a], i) => (
              <div key={d} className={`flex justify-between gap-2 py-1.5 ${i <= t ? "" : "opacity-30"}`}>
                <span className="text-zinc-500">{d}</span>
                <span className="min-w-0 flex-1 truncate">{n}</span>
                <span className="tabular-nums">{a}</span>
              </div>
            ))}
          </div>
          <Show when={t >= 2}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
                <CreditCard className="size-4" /> 카드 대조 결과
              </p>
              <p className="text-[11.5px] text-amber-900">법인카드 32건 중 31건 맞음 · <b>영수증이 빠진 1건</b>(11/18 주유 62,000원)</p>
            </div>
          </Show>
          <Show when={t >= 3}>
            <Say>빠진 영수증은 마감 전에 채워 넣어요</Say>
          </Show>
        </Panel>
      );
    if (step === 1)
      return (
        <Panel title="세무 마감 · 11월" sub={t >= 4 ? "마감 완료" : "마감 처리 중"} className="mx-auto max-w-[24rem]">
          <ul className="flex flex-col gap-2">
            {FILES.map(({ icon: Icon, name, note, cls }, i) => (
              <li key={name} className="flex items-center gap-2.5 rounded-xl border border-zinc-200 p-2.5">
                <Icon className={`size-5 shrink-0 ${cls}`} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[12.5px]">{name}</b>
                  <span className="text-[11px] text-zinc-500">{note}</span>
                </span>
                {t > i ? <Check className="landing-row size-4 text-emerald-500" style={{ animationDelay: "0s" }} /> : <span className="size-4 animate-spin rounded-full border-2 border-zinc-200 border-t-brand-500" />}
              </li>
            ))}
          </ul>
          <Show when={t >= 4}>
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-[12.5px] font-semibold text-emerald-800">마감 완료 · 세무사무소에 보냈어요</p>
          </Show>
        </Panel>
      );
    return (
      <Duo>
        <Panel title="세무사무소 화면" sub="예시 세무회계" className="max-w-[24rem]">
          <p className="text-[11px] text-zinc-500">맡은 회사</p>
          <div className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${t >= 1 ? "border-brand-300 bg-brand-50" : "border-zinc-200"}`}>
            <span>
              <b className="block">예시 회사</b>
              <span className="text-[11px] text-zinc-500">11월 마감 도착 · 31건</span>
            </span>
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">새 마감</span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-2.5 text-zinc-500">
            <span>다른 회사 · 10월</span>
            <span className="text-[10px]">받음</span>
          </div>
          <Show when={t >= 1} className="grid grid-cols-3 gap-1.5">
            {FILES.map(({ icon: Icon, name, cls }) => (
              <span key={name} className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 bg-white p-2 text-center text-[10.5px] font-semibold">
                <Icon className={`size-5 ${cls}`} /> {name}
              </span>
            ))}
          </Show>
        </Panel>
        <div className="max-w-[14rem] sm:pt-10">
          <Show when={t >= 2}>
            <Say>메일·압축 파일 없이 세무사무소가 바로 받아요</Say>
          </Show>
        </div>
      </Duo>
    );
  },
};
