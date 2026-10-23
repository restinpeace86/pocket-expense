"use server";

import { refresh } from "next/cache";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// 내 정보 저장 — 검사(이름·휴대폰·계좌 모두/모두 비움·선택 동의)는 DB의 update_my_profile(036)이 한다
export async function updateMyProfileAction(input: {
  name: string;
  phone: string;
  position: string;
  employeeNumber: string;
  vehicleNumber: string;
  fuelType: "gasoline" | "diesel" | "lpg" | null; // 차량 유종(D-117)
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  optionalAgreed: boolean;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_name: input.name,
    p_phone: input.phone,
    p_position: input.position,
    p_employee_number: input.employeeNumber,
    p_vehicle_number: input.vehicleNumber,
    p_bank_name: input.bankName,
    p_account_number: input.accountNumber,
    p_account_holder: input.accountHolder,
    p_optional_agreed: input.optionalAgreed,
  });
  if (error) return { error: messageForDbError(error) };
  const { error: fuelError } = await supabase.rpc("set_my_fuel_type", { p_fuel_type: (input.fuelType ?? null) as unknown as string /* 안 고르면 null = 휘발유로 계산 */ });
  if (fuelError) return { error: messageForDbError(fuelError) };
  refresh();
  return { error: null };
}
