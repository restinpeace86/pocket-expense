"use server";

import { refresh } from "next/cache";
import { recordBusinessCheck } from "@/lib/business/record";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

export type CompanySettingsInput = {
  name: string;
  businessNumber: string;
  mealLimitEnabled: boolean;
  mealLimitPerPerson: number;
  mealLimitMode: "split" | "notify";
  fuelEnabled: boolean;
  fuelRatePerKm: number;
  odometerPhotoRequired: boolean;
  claimDeadlineType: "none" | "end_of_month" | "days_after" | "next_month_day";
  claimDeadlineDays: number | null;
};

// 회사·정책 설정 저장 (spec/screens/admin-settings.md §1·§2). 검증·권한·사업자번호 재판정·정책 확인 시각은 DB의 update_company_settings가 한다(015, 019).
export async function saveCompanySettingsAction(input: CompanySettingsInput): Promise<ActionResult> {
  const supabase = await createClient();
  const businessNumber = input.businessNumber.replace(/\D/g, "");
  await recordBusinessCheck(supabase, businessNumber);
  const { error } = await supabase.rpc("update_company_settings", {
    p_name: input.name,
    p_business_number: businessNumber,
    p_meal_limit_per_person: input.mealLimitPerPerson,
    p_meal_limit_mode: input.mealLimitMode,
    p_fuel_rate_per_km: input.fuelRatePerKm,
    p_claim_deadline_type: input.claimDeadlineType,
    p_claim_deadline_days: input.claimDeadlineDays as number,
    p_meal_limit_enabled: input.mealLimitEnabled,
    p_fuel_enabled: input.fuelEnabled,
    p_odometer_photo_required: input.odometerPhotoRequired,
  });
  if (error) return { error: messageForDbError(error) };
  refresh();
  return { error: null };
}
