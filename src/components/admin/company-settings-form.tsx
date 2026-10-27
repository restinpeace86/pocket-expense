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
import { measureAction } from "@/lib/perf/client";

const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const formatBizNo = (v: string) => v.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");
const digits = (v: string) => v.replace(/[^0-9]/g, "");
const toInt = (v: string) => {
  const d = digits(v);
  return d ? Number(d) : -1;
};

const won2 = (n: number | string | null) => (n == null ? "-" : `${Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`);

// 회사 정보 · 정산 정책 (spec/screens/admin-settings.md §1·§2). 설명 구성은 ui-rules.md §6.
export function CompanySettingsForm({ settings: s, preview = false }: { settings: CompanySettings; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mealEnabled, setMealEnabled] = useState(s.meal_limit_enabled);
  const [mealLimit, setMealLimit] = useState(String(s.meal_limit_per_person));
  const [fuelEnabled, setFuelEnabled] = useState(s.fuel_enabled);
  // 계기판 사진 받기(D-070 ②) — 직원 자차 항목에 출발·도착 사진 2장 필수(D-144, D-121 숨김 해제)
  const [odometer, setOdometer] = useState(s.odometer_photo_required);
  const [mode, setMode] = useState(s.meal_limit_mode);
  const [fuelRate, setFuelRate] = useState(String(s.fuel_rate_per_km));
  const [fuelMode, setFuelMode] = useState<"fixed" | "opinet">(s.fuel_rate_mode);
  const [perDiemOn, setPerDiemOn] = useState(s.per_diem_enabled);
  const [perDiem, setPerDiem] = useState(String(s.per_diem_amount || 30000));
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
      const r = await measureAction("settings.save", () =>
        saveCompanySettingsAction({
        name: String(f.get("name") ?? ""),
        businessNumber: String(f.get("businessNumber") ?? ""),
        mealLimitEnabled: mealEnabled,
        mealLimitPerPerson: toInt(mealLimit),
        mealLimitMode: mode,
        fuelEnabled,
        fuelRatePerKm: toInt(fuelRate),
        fuelRateMode: fuelMode,
        perDiemEnabled: perDiemOn,
        perDiemAmount: toInt(perDiem),
        odometerPhotoRequired: odometer,
        claimDeadlineType: deadline,
        claimDeadlineDays: deadline === "days_after" || deadline === "next_month_day" ? toInt(deadlineDays) : null,
        }),
      );
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
              <p>
                <b>점심만인가요?</b> 아니에요. 평소 점심과 야근 식사 모두 같은 1식 한도가 적용돼요. 한도 없이 실비로 지원하는 회사라면 &lsquo;한도 없이 전액
                지원&rsquo;을 고르세요.
              </p>
              <p>직원별로 한도를 다르게 정하는 기능(예외 한도)은 준비 중이에요.</p>
            </>
          }
        />
        <div className="mt-4">
          <ChoiceCards
            name="mealLimitEnabled"
            label="식대 지원 방식"
            value={mealEnabled ? "limit" : "full"}
            onChange={(v) => setMealEnabled(v === "limit")}
            choices={[
              {
                value: "limit",
                label: "1인 한도 적용",
                description: "1인 한도 × 함께 먹은 인원수까지 지원해요.",
                extra: (
                  <div className="flex flex-col gap-4">
                    <div className="sm:max-w-xs">
                      <Field label="1식 1인당 식대 한도" required>
                        <AmountInput name="mealLimit" value={mealLimit} onChange={setMealLimit} required />
                      </Field>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium text-zinc-800">한도를 넘으면</p>
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
                    </div>
                  </div>
                ),
              },
              {
                value: "full",
                label: "한도 없이 전액 지원",
                description: "영수증 금액을 그대로 지원해요. 승인할 때 관리자가 판단해요.",
                example: "예: 2명이 40,000원 먹으면 40,000원 모두 지원",
              },
            ]}
          />
        </div>
      </section>

      <section className={card}>
        <SectionHeading
          title="자차 유류비"
          summary="직원이 자기 차로 출장 갔을 때 주는 기름값이에요. km당 정해진 단가 또는 그날 전국 평균 유가로 계산해요."
          helpId="settings.fuel-rate"
          help={
            <>
              <p>
                <b>어떻게 계산하나요?</b> 청구 금액 = 주행거리(km) × 이 단가예요. 자차 출장은 주유 영수증 없이 출발지·도착지와 거리로 청구해요.
              </p>
              <p>유가가 크게 바뀌면 단가를 조정하세요. 바꾼 단가는 이후 상신되는 경비부터 적용돼요.</p>
              <p>
                <b>증빙은 어떻게 하나요?</b> 주유 영수증 대신 직원이 입력한 출발지·도착지·거리·출장 목적이 기록으로 남고, 세무 마감 자료에 함께 나가요. 더 확실한
                증빙이 필요하면 계기판 사진 받기를 켜세요.
              </p>
              <p>자차 출장비를 지원하지 않는 회사라면 &lsquo;사용 안 함&rsquo;을 고르세요. 자가운전보조금을 받는 직원은 멤버 관리에서 따로 막을 수 있어요.</p>
            </>
          }
        />
        <div className="mt-4">
          <ChoiceCards
            name="fuelEnabled"
            label="자차 유류비 지원"
            value={fuelEnabled ? "on" : "off"}
            onChange={(v) => setFuelEnabled(v === "on")}
            choices={[
              {
                value: "on",
                label: "자차 유류비 지원",
                description: "주행거리로 계산해요. 계산 방식을 골라 주세요.",
                extra: (
                  <div className="flex flex-col gap-4">
                    {/* 계산 방식(D-117): 고정 단가 / 전국 평균 유가(오피넷) */}
                    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="자차 유류비 계산 방식">
                      {(
                        [
                          ["fixed", "km당 고정 단가", `주행거리 × ${formatWon(rate)}`],
                          ["opinet", "전국 평균 유가 기준", "(출장 당일 전국 평균 유가 ÷ 12km/L) × 주행거리, 원 단위 올림"],
                        ] as const
                      ).map(([v, label, desc]) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={fuelMode === v}
                          onClick={() => setFuelMode(v)}
                          className={`flex min-h-11 flex-col items-start rounded-xl border px-3 py-2 text-left text-sm ${fuelMode === v ? "border-brand-600 bg-brand-50" : "border-zinc-300 bg-white hover:bg-zinc-50"}`}
                        >
                          <span className="font-semibold text-zinc-900">{label}</span>
                          <span className="text-xs text-zinc-600">{desc}</span>
                        </button>
                      ))}
                    </div>
                    <div className="sm:max-w-xs">
                      <Field
                        label={fuelMode === "opinet" ? "km당 고정 단가 (유가 정보가 없을 때 대신 씀)" : "km당 유류비 단가"}
                        required
                        hint={`예: 120km × ${formatWon(rate)} = ${formatWon(120 * rate)}`}
                      >
                        <AmountInput name="fuelRate" value={fuelRate} onChange={setFuelRate} required />
                      </Field>
                      {/* 왜 200원인지(D-117) */}
                      <p className="mt-1.5 text-xs text-zinc-500">
                        기본 200원은 대략 휘발유 L당 1,700원 ÷ 연비 약 10km/L ≈ 170원에 타이어·엔진오일 같은 차량 소모를 조금 더한, 많이 쓰는 기준이에요. 회사 여비 규정에 맞게 바꾸세요.
                      </p>
                    </div>
                    {fuelMode === "opinet" && (
                      <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        {s.latest_oil ? (
                          <>
                            <p>
                              최근 전국 평균({s.latest_oil.log_date.slice(5).replace("-", "/")}): 휘발유 {won2(s.latest_oil.gasoline)} · 경유 {won2(s.latest_oil.diesel)} · LPG {won2(s.latest_oil.lpg)}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              예: 휘발유 120km → ({won2(s.latest_oil.gasoline)} ÷ 12km/L) × 120km = {s.latest_oil.gasoline ? formatWon(Math.ceil((Number(s.latest_oil.gasoline) * 120) / 12)) : "-"} · 유종은 직원 [내 정보]에서 골라요(안 고르면 휘발유)
                            </p>
                          </>
                        ) : (
                          <p>아직 받아 온 전국 평균 유가가 없어요. 오피넷 유가는 매일 새벽 자동으로 받아요 — 받기 전에는 위 고정 단가로 계산돼요.</p>
                        )}
                        <p className="mt-1 text-xs text-zinc-500">출처: 한국석유공사 오피넷 전국 주유소 평균 가격. 출장 당일 값이 없으면 7일 안 가장 최근 값, 그것도 없으면 고정 단가로 계산해요.</p>
                      </div>
                    )}
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={odometer}
                        onChange={(e) => setOdometer(e.target.checked)}
                        className="mt-0.5 size-5 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-900">출발·도착 계기판 사진 받기 (선택)</span>
                        <span className="block text-sm text-zinc-600">거리 증빙이 더 확실해지지만 직원이 자차 항목마다 사진 2장을 더 올려야 해요.</span>
                      </span>
                    </label>
                  </div>
                ),
              },
              {
                value: "off",
                label: "사용 안 함",
                description: "직원 화면에 '자차 유류비' 항목이 보이지 않아요.",
              },
            ]}
          />
        </div>
      </section>

      <section className={card}>
        <SectionHeading
          title="출장 일비"
          summary="출장 하루마다 영수증 없이 주는 정해진 금액이에요(식비 포함)."
          helpId="settings.per-diem"
          help={
            <>
              <p>
                <b>어떻게 들어가나요?</b> 출장 결의서의 출장 기간(시작일~끝나는 날)만큼 &lsquo;출장 일비 하루 금액 × 일수&rsquo; 한 줄이 자동으로 들어가요. 직원은
                고치거나 지울 수 없고, 영수증도 필요 없어요. 계정과목은 출장비(여비교통비)로 나가요.
              </p>
              <p>
                <b>무엇을 대신하나요?</b> 출장 중 식비와 잡비예요. 그래서 일비를 쓰면 출장 식비 영수증은 따로 받지 않아요(올리면 상신 전에 빼라고 안내해요).
                출장지까지 가는 교통비(KTX·자차 유류비·통행료)와 숙박비는 지금처럼 영수증으로 받아요.
              </p>
              <p>회사 여비 규정에 일비가 있을 때만 켜세요. 세무 처리는 세무사무소와 확인해 주세요.</p>
            </>
          }
        />
        <div className="mt-4">
          <ChoiceCards
            name="perDiemEnabled"
            label="출장 일비"
            value={perDiemOn ? "on" : "off"}
            onChange={(v) => setPerDiemOn(v === "on")}
            choices={[
              {
                value: "on",
                label: "출장 일비 지급",
                description: "출장 하루마다 정해진 금액을 줘요(식비 포함).",
                example: `예: 1박 2일 출장 → ${(Math.max(0, toInt(perDiem)) * 2).toLocaleString("ko-KR")}원(하루 ${Math.max(0, toInt(perDiem)).toLocaleString("ko-KR")}원 × 2일)`,
                extra: (
                  <div className="sm:max-w-xs">
                    <Field label="하루 일비" required>
                      <AmountInput name="perDiem" value={perDiem} onChange={setPerDiem} required />
                    </Field>
                  </div>
                ),
              },
              { value: "off", label: "사용 안 함", description: "출장 식비는 영수증으로 받아요(식대 한도 적용)." },
            ]}
          />
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
