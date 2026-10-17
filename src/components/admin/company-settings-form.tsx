"use client";

import { useState, useTransition } from "react";
import { saveCompanySettingsAction } from "@/app/workspace/[id]/admin/settings/actions";
import { ClaimDeadlineSection, DEADLINE_DAYS, type DeadlineType } from "./claim-deadline-section";
import { Field, FormError } from "@/components/onboarding/field";
import { AmountInput } from "@/components/ui/amount-input";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { CompanySettings } from "@/lib/admin/queries";
import { formatWon } from "@/lib/format";

const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const formatBizNo = (v: string) => v.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");
const digits = (v: string) => v.replace(/[^0-9]/g, "");
const toInt = (v: string) => {
  const d = digits(v);
  return d ? Number(d) : -1;
};

// 회사 정보 · 정산 정책 (spec/screens/admin-settings.md §1·§2). 설명 구성은 ui-rules.md §6.
export function CompanySettingsForm({ settings: s, preview = false }: { settings: CompanySettings; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mealLimit, setMealLimit] = useState(String(s.meal_limit_per_person));
  const [mode, setMode] = useState(s.meal_limit_mode);
  const [fuelRate, setFuelRate] = useState(String(s.fuel_rate_per_km));
  const [deadline, setDeadline] = useState<DeadlineType>(s.claim_deadline_type);
  const [deadlineDays, setDeadlineDays] = useState(String(s.claim_deadline_days ?? DEADLINE_DAYS.next_month_day.initial));

  // 예시 계산 (③ 선택한 항목에만): 1인 한도 × 2명보다 5,000원 더 나온 식사
  const limit = Math.max(0, toInt(mealLimit));
  const mealTotal = limit * 2 + 5000;
  const rate = Math.max(0, toInt(fuelRate));

  // 저장 실패 시 입력값이 지워지지 않도록 onSubmit
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) return;
    const f = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await saveCompanySettingsAction({
        name: String(f.get("name") ?? ""),
        businessNumber: String(f.get("businessNumber") ?? ""),
        mealLimitPerPerson: toInt(mealLimit),
        mealLimitMode: mode,
        fuelRatePerKm: toInt(fuelRate),
        claimDeadlineType: deadline,
        claimDeadlineDays: deadline === "days_after" || deadline === "next_month_day" ? toInt(deadlineDays) : null,
      });
      if (r.error) setError(r.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <section className={card}>
        <SectionHeading
          title="회사 정보"
          summary="회사를 구분하는 기본 정보예요."
          helpId="settings.company"
          helpLabel="사업자등록번호를 바꾸면?"
          help={
            <p>
              사업자등록번호는 회사를 등록할 때 실제 사업자인지 확인한 번호예요. 바꾸면 회사 등록 때와 같은 확인 절차를 다시 거쳐요. 하이픈(-)은 넣어도 되고
              빼도 돼요.
            </p>
          }
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="회사명" required>
            <input name="name" defaultValue={s.name} className={inputClass} maxLength={100} required />
          </Field>
          <Field label="사업자등록번호" required>
            <input name="businessNumber" defaultValue={formatBizNo(s.business_number)} className={inputClass} inputMode="numeric" required />
          </Field>
        </div>
      </section>

      <section className={card}>
        <SectionHeading
          title="식대 한도"
          summary="한 끼 식사에 직원 1명당 회사가 지원하는 금액이에요."
          helpId="settings.meal-limit"
          help={
            <>
              <p>
                <b>어떻게 계산하나요?</b> 영수증에는 몇 명이 먹었는지 나오지 않아서 직원이 인원수를 적어요. 회사 지원 한도는 &lsquo;1인 한도 × 인원수&rsquo;예요.
                일반 식대와 출장 중 식비 모두 같은 방식이에요.
              </p>
              <p>
                <b>한도를 넘으면?</b> 두 가지 중 고를 수 있어요. 넘은 금액을 직원이 내게 하거나(절사), 일단 전부 지원하고 &lsquo;한도 초과&rsquo; 표시만 붙여
                승인할 때 판단해요(자율 승인).
              </p>
              <p>직원별로 한도를 다르게 정하는 기능(예외 한도)은 준비 중이에요.</p>
            </>
          }
        />
        <div className="mt-4 grid gap-4 sm:max-w-xs">
          <Field label="1식 1인당 식대 한도" required>
            <AmountInput name="mealLimit" value={mealLimit} onChange={setMealLimit} required />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-sm font-medium text-zinc-800">한도를 넘으면</p>
        <ChoiceCards
          name="mealLimitMode"
          label="한도 초과 처리 방식"
          value={mode}
          onChange={setMode}
          choices={[
            {
              value: "split",
              label: "초과분은 개인 부담 (절사)",
              description: "한도까지만 회사가 지원해요.",
              example: `예: 2명이 ${formatWon(mealTotal)} 먹으면 회사 ${formatWon(limit * 2)} · 직원 부담 5,000원`,
            },
            {
              value: "notify",
              label: "그대로 지원하고 표시만 (자율 승인)",
              description: "전부 지원하고 '한도 초과'만 표시해요.",
              example: `예: 2명이 ${formatWon(mealTotal)} 먹으면 ${formatWon(mealTotal)} 모두 지원 + '한도 초과' 표시`,
            },
          ]}
        />
      </section>

      <section className={card}>
        <SectionHeading
          title="자차 유류비"
          summary="직원이 자기 차로 출장 갔을 때 1km마다 회사가 주는 금액이에요."
          helpId="settings.fuel-rate"
          help={
            <>
              <p>
                <b>어떻게 계산하나요?</b> 청구 금액 = 주행거리(km) × 이 단가예요. 자차 출장은 주유 영수증 없이 출발지·도착지와 거리로 청구해요.
              </p>
              <p>유가가 크게 바뀌면 단가를 조정하세요. 바꾼 단가는 이후 상신되는 경비부터 적용돼요.</p>
            </>
          }
        />
        <div className="mt-4 grid gap-4 sm:max-w-xs">
          <Field label="km당 유류비 단가" required hint={`예: 120km × ${formatWon(rate)} = ${formatWon(120 * rate)}`}>
            <AmountInput name="fuelRate" value={fuelRate} onChange={setFuelRate} required />
          </Field>
        </div>
      </section>

      <ClaimDeadlineSection
        type={deadline}
        days={deadlineDays}
        onTypeChange={(t) => {
          setDeadline(t);
          // 선택지마다 N의 뜻(다음 달 며칠 / 결제 후 며칠)이 달라서, 저장된 선택지면 저장값, 아니면 그 선택지의 기본값을 보여 준다
          if (t === "next_month_day" || t === "days_after") {
            const savedDays = t === s.claim_deadline_type ? s.claim_deadline_days : null;
            setDeadlineDays(String(savedDays ?? DEADLINE_DAYS[t].initial));
          }
        }}
        onDaysChange={setDeadlineDays}
      />

      <FormError message={error} />
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">저장했어요. 변경 내용은 이후 상신되는 경비부터 적용됩니다.</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
        <span className="text-xs text-zinc-500">변경 내용은 이후 상신되는 경비부터 적용돼요. 이미 상신한 경비는 그대로예요.</span>
      </div>
    </form>
  );
}
