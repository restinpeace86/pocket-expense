"use client";

import { ChoiceCards } from "@/components/ui/choice-cards";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";

export type DeadlineType = "none" | "end_of_month" | "days_after" | "next_month_day";

// 선택지별 N의 범위와 처음 보여 줄 값
export const DEADLINE_DAYS = {
  next_month_day: { min: 1, max: 28, initial: 5 },
  days_after: { min: 1, max: 90, initial: 30 },
} as const;

function DaysInput({ prefix, suffix, value, onChange, label }: { prefix?: string; suffix: string; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {prefix && <span className="whitespace-nowrap text-sm text-zinc-700">{prefix}</span>}
      <div className="w-20 shrink-0">
        <input
          name="deadlineDays"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          className={inputClass}
          inputMode="numeric"
          aria-label={label}
          required
        />
      </div>
      <span className="whitespace-nowrap text-sm text-zinc-700">{suffix}</span>
    </div>
  );
}

// 청구 기한 설정 (spec/screens/admin-settings.md §2.1, D-031, D-064). 설명 구성은 ui-rules.md §6.
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
  const n = Number(days) || "N";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <SectionHeading
        title="청구 기한"
        summary={
          <>
            직원이 쓴 경비를 <b>영수증과 함께 지출결의서로 올려야 하는 기한</b>이에요.
          </>
        }
        helpId="settings.claim-deadline"
        help={
          <>
            <p>
              <b>왜 정해 두나요?</b> 매달 경비를 정리(마감)하려면 &lsquo;지난달 영수증은 언제까지 다 들어온다&rsquo;는 기준이 필요해요. 기한이 없으면 몇 달
              지난 영수증이 갑자기 들어와, 이미 끝낸 정산과 세무사무소에 넘긴 자료를 다시 고쳐야 할 수 있어요.
            </p>
            <p>
              <b>무엇을 고르면 되나요?</b> 많은 회사가 &lsquo;다음 달 초 며칠까지&rsquo;로 정해요. 한 달 경비를 다음 달 초에 한 번에 마감할 수 있고, 월말에 쓴
              경비도 여유 있게 올릴 수 있어요. &lsquo;결제한 달 말일까지&rsquo;는 월말 경비에 하루이틀밖에 없어서 놓치기 쉬워요.
            </p>
            <p>
              <b>기한이 지나면?</b> 청구를 막지는 않아요(받아야 할 돈일 수 있으니까요). 직원에게는 늦은 이유를 적으라는 안내가 뜨고, 승인 화면에는
              &lsquo;기한 초과&rsquo; 표시가 붙어서 관리자가 보고 판단하면 돼요.
            </p>
          </>
        }
      />
      <div className="mt-4">
        <ChoiceCards
          name="claimDeadlineType"
          label="청구 기한 방식"
          value={type}
          onChange={onTypeChange}
          choices={[
            {
              value: "next_month_day",
              label: "결제한 다음 달 N일까지",
              badge: "추천",
              description: "한 달 경비를 다음 달 초에 한 번에 마감해요.",
              example: `예: 10월에 쓴 경비는 11월 ${n}일까지 · 10월 30일 영수증도 11월 ${n}일까지 올리면 돼요`,
              extra: (
                <DaysInput
                  prefix="다음 달"
                  suffix={`일까지 (${DEADLINE_DAYS.next_month_day.min}~${DEADLINE_DAYS.next_month_day.max})`}
                  value={days}
                  onChange={onDaysChange}
                  label="다음 달 며칠까지"
                />
              ),
            },
            {
              value: "days_after",
              label: "결제일로부터 N일 이내",
              description: "경비마다 기한이 따로 정해져요.",
              example: `예: 10월 30일 영수증은 결제한 날부터 ${n}일 안에 올려야 해요`,
              extra: (
                <DaysInput
                  suffix={`일 이내 (${DEADLINE_DAYS.days_after.min}~${DEADLINE_DAYS.days_after.max})`}
                  value={days}
                  onChange={onDaysChange}
                  label="결제일로부터 며칠 이내"
                />
              ),
            },
            {
              value: "end_of_month",
              label: "결제한 달의 말일까지",
              description: "가장 엄격해요. 월말 경비는 놓치기 쉬워요.",
              example: "예: 10월 30일 영수증은 10월 31일까지",
            },
            { value: "none", label: "사용 안 함", description: "기한 없이 언제든 올려요. '기한 초과' 표시도 없어요." },
          ]}
        />
      </div>
    </section>
  );
}
