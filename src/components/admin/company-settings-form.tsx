"use client";

import { useState, useTransition } from "react";
import { saveCompanySettingsAction } from "@/app/workspace/[id]/admin/settings/actions";
import { Field, FormError } from "@/components/onboarding/field";
import { inputClass } from "@/components/ui/page-shell";
import type { CompanySettings } from "@/lib/admin/queries";

const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const formatBizNo = (v: string) => v.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");
const toInt = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : -1;
};

type Choice<T extends string> = { value: T; label: string; description: string };

function RadioCards<T extends string>({
  name,
  choices,
  value,
  onChange,
}: {
  name: string;
  choices: Choice<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((c) => (
        <label
          key={c.value}
          className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${value === c.value ? "border-blue-500 bg-blue-50/60" : "border-zinc-200 hover:bg-zinc-50"}`}
        >
          <input type="radio" name={name} value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} className="mt-1 size-4 shrink-0 accent-blue-600" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-900">{c.label}</span>
            <span className="block text-sm text-zinc-600">{c.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

// 회사 정보 · 정산 정책 (spec/screens/admin-settings.md §1·§2)
export function CompanySettingsForm({ settings: s, preview = false }: { settings: CompanySettings; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(s.meal_limit_mode);
  const [deadline, setDeadline] = useState(s.claim_deadline_type);

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
        mealLimitPerPerson: toInt(f.get("mealLimit")),
        mealLimitMode: mode,
        fuelRatePerKm: toInt(f.get("fuelRate")),
        claimDeadlineType: deadline,
        claimDeadlineDays: deadline === "days_after" ? toInt(f.get("deadlineDays")) : null,
      });
      if (r.error) setError(r.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="font-semibold">회사 정보</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="회사명" required>
            <input name="name" defaultValue={s.name} className={inputClass} maxLength={100} required />
          </Field>
          <Field label="사업자등록번호" required hint="숫자 10자리 (하이픈은 넣어도 되고 빼도 돼요)">
            <input name="businessNumber" defaultValue={formatBizNo(s.business_number)} className={inputClass} inputMode="numeric" required />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">식대 한도</h2>
        <p className="mt-1 text-sm text-zinc-600">일반 식대와 출장 식비 모두 &lsquo;1인 한도 × 함께 먹은 인원수&rsquo;로 계산해요. 직원별 예외 한도는 멤버 관리에서 정할 수 있어요.</p>
        <div className="mt-4 grid gap-4 sm:max-w-xs">
          <Field label="1식 1인당 식대 한도 (원)" required>
            <input name="mealLimit" defaultValue={s.meal_limit_per_person} className={inputClass} inputMode="numeric" required />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-sm font-medium text-zinc-800">한도를 넘으면</p>
        <RadioCards
          name="mealLimitMode"
          value={mode}
          onChange={setMode}
          choices={[
            { value: "split", label: "초과분은 개인 부담 (절사)", description: "한도까지만 회사가 지원하고, 넘은 금액은 직원 부담으로 나눠요." },
            { value: "notify", label: "그대로 지원하고 표시만 (자율 승인)", description: "영수증 금액을 모두 지원하고 '한도 초과' 배지만 붙여요. 승인할 때 확인하세요." },
          ]}
        />
      </section>

      <section className={card}>
        <h2 className="font-semibold">자차 유류비</h2>
        <div className="mt-4 grid gap-4 sm:max-w-xs">
          <Field label="km당 유류비 단가 (원)" required hint="자차 출장비 = 주행거리 × 단가">
            <input name="fuelRate" defaultValue={s.fuel_rate_per_km} className={inputClass} inputMode="numeric" required />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">청구 기한</h2>
        <p className="mb-3 mt-1 text-sm text-zinc-600">기한이 지나도 청구는 막지 않아요. 직원 화면과 결재 화면에 &lsquo;기한 초과&rsquo; 표시만 붙어요.</p>
        <RadioCards
          name="claimDeadlineType"
          value={deadline}
          onChange={setDeadline}
          choices={[
            { value: "none", label: "사용 안 함", description: "기한 없이 언제든 청구해요." },
            { value: "end_of_month", label: "결제한 달의 말일까지", description: "예: 10월 15일 결제 → 10월 31일까지" },
            { value: "days_after", label: "결제일로부터 N일 이내", description: "예: 30일로 정하면 결제한 날부터 30일 안에 청구해야 해요." },
          ]}
        />
        {deadline === "days_after" && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-24 shrink-0">
              <input
                name="deadlineDays"
                defaultValue={s.claim_deadline_days ?? 30}
                className={inputClass}
                inputMode="numeric"
                aria-label="결제일로부터 며칠 이내"
                required
              />
            </div>
            <span className="whitespace-nowrap text-sm text-zinc-700">일 이내 (1~90일)</span>
          </div>
        )}
      </section>

      <FormError message={error} />
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">저장했어요. 변경 내용은 이후 상신되는 경비부터 적용됩니다.</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full shrink-0 whitespace-nowrap items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
        <span className="text-xs text-zinc-500">변경 내용은 이후 상신되는 경비부터 적용돼요. 이미 상신한 경비는 그대로예요.</span>
      </div>
    </form>
  );
}
