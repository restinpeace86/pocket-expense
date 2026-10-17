"use client";

import { inputClass } from "@/components/ui/page-shell";

export type DeadlineType = "none" | "end_of_month" | "days_after" | "next_month_day";

// 선택지별 N의 범위와 처음 보여 줄 값
export const DEADLINE_DAYS = {
  next_month_day: { min: 1, max: 28, initial: 5 },
  days_after: { min: 1, max: 90, initial: 30 },
} as const;

// 청구 기한 설정 (spec/screens/admin-settings.md §2.1, D-031, D-064).
// 관리자가 처음 보고도 이해하도록: 무엇의 기한인지 → 왜 필요한지 → 선택지(추천 먼저, 예시 포함) → 지나면 어떻게 되는지.
export function ClaimDeadlineSection({
  type,
  days,
  onTypeChange,
  onDaysChange,
}: {
  type: DeadlineType;
  days: string;
  onTypeChange: (t: DeadlineType) => void;
  onDaysChange: (d: string) => void;
}) {
  // 예시 문구의 N: 선택된 선택지는 지금 입력값, 나머지는 그 선택지의 기본값
  const nFor = (t: "next_month_day" | "days_after") => (type === t ? Number(days) || "N" : DEADLINE_DAYS[t].initial);
  const nm = nFor("next_month_day");
  const da = nFor("days_after");
  const choices: { value: DeadlineType; label: string; badge?: string; description: string; example?: string }[] = [
    {
      value: "next_month_day",
      label: "결제한 다음 달 N일까지",
      badge: "추천",
      description: "한 달 동안 쓴 경비를 다음 달 초에 한 번에 마감해요. 월말에 쓴 경비도 여유 있게 올릴 수 있어 많은 회사가 이 방식을 써요.",
      example: `예: 10월에 쓴 경비는 11월 ${nm}일까지 · 10월 30일에 쓴 영수증도 11월 ${nm}일까지 올리면 돼요`,
    },
    {
      value: "days_after",
      label: "결제일로부터 N일 이내",
      description: "경비마다 기한이 따로 정해져요. 출장이 길어 몇 주 뒤에 몰아서 올리는 회사에 맞아요.",
      example: `예: ${da}일로 정하면 결제한 날부터 ${da}일 안에 올려야 해요`,
    },
    {
      value: "end_of_month",
      label: "결제한 달의 말일까지",
      description: "가장 엄격해요. 월말에 쓴 경비는 하루이틀 안에 올려야 해서 기한을 놓치기 쉬워요.",
      example: "예: 10월 30일에 쓴 영수증은 10월 31일까지",
    },
    { value: "none", label: "사용 안 함", description: "기한 없이 언제든 올릴 수 있어요. '기한 초과' 표시도 붙지 않아요." },
  ];

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">청구 기한</h2>
      <p className="mt-1 text-sm text-zinc-700">
        직원이 개인카드·법인카드로 쓴 경비를 <b>영수증과 함께 지출소명서로 올려야 하는 기한</b>이에요.
      </p>
      <div className="mt-3 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">왜 정해 두나요?</p>
        <p className="mt-1">
          매달 경비를 정리(마감)하려면 &lsquo;지난달 영수증은 언제까지 다 들어온다&rsquo;는 기준이 필요해요. 기한이 없으면 몇 달 지난 영수증이 갑자기
          들어와, 이미 끝낸 정산과 세무사무소에 넘긴 자료를 다시 고쳐야 할 수 있어요.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="청구 기한 방식">
        {choices.map((c) => {
          const selected = type === c.value;
          const range = c.value === "next_month_day" || c.value === "days_after" ? DEADLINE_DAYS[c.value] : null;
          return (
            <div key={c.value} className={`rounded-xl border ${selected ? "border-blue-500 bg-blue-50/60" : "border-zinc-200 hover:bg-zinc-50"}`}>
              <label className="flex cursor-pointer gap-3 p-3">
                <input
                  type="radio"
                  name="claimDeadlineType"
                  value={c.value}
                  checked={selected}
                  onChange={() => onTypeChange(c.value)}
                  className="mt-1 size-4 shrink-0 accent-blue-600"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-zinc-900">
                    {c.label}
                    {c.badge && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">{c.badge}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-600">{c.description}</span>
                  {c.example && <span className="mt-1 block text-xs text-zinc-500">{c.example}</span>}
                </span>
              </label>
              {selected && range && (
                <div className="flex items-center gap-2 px-3 pb-3 pl-10">
                  {c.value === "next_month_day" && <span className="whitespace-nowrap text-sm text-zinc-700">다음 달</span>}
                  <div className="w-20 shrink-0">
                    <input
                      name="deadlineDays"
                      value={days}
                      onChange={(e) => onDaysChange(e.target.value.replace(/[^0-9]/g, ""))}
                      className={inputClass}
                      inputMode="numeric"
                      aria-label={c.value === "next_month_day" ? "다음 달 며칠까지" : "결제일로부터 며칠 이내"}
                      required
                    />
                  </div>
                  <span className="whitespace-nowrap text-sm text-zinc-700">
                    {c.value === "next_month_day" ? "일까지" : "일 이내"} ({range.min}~{range.max})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">기한이 지나면?</p>
        <p className="mt-1">
          청구를 막지는 않아요(받아야 할 돈일 수 있으니까요). 직원에게는 늦은 이유를 적으라는 안내가 뜨고, 승인 화면에는 &lsquo;기한 초과&rsquo; 표시가
          붙어서 관리자가 보고 판단하면 돼요.
        </p>
      </div>
    </section>
  );
}
