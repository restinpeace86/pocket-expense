"use server";

import { refresh } from "next/cache";
import { getMembership } from "@/lib/auth/session";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 회사차량 (D-105). 별칭·차량번호만 저장한다. 회사차량 결의서에서 직원이 차량을 고르고, 세무 마감 자료에 차량별로 남는다.
function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "같은 차량번호로 사용 중인 차량이 이미 있어요.";
  if (error.code === "23514") return "별칭은 1~30자, 차량번호는 2~20자로 입력해 주세요.";
  if (error.code === "42501") return messageForDbError({ message: "NOT_ALLOWED" });
  return messageForDbError(error);
}

export type VehicleInput = { nickname: string; plateNumber: string };
const clean = (v: VehicleInput) => ({ nickname: v.nickname.trim(), plate_number: v.plateNumber.replace(/\s+/g, "").trim() });

export async function addVehicleAction(input: VehicleInput): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") return { error: messageForDbError({ message: "NOT_A_MEMBER" }) };
  const supabase = await createClient();
  const { error } = await supabase.from("company_vehicles").insert({ company_id: membership.company_id, ...clean(input) });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { error: null };
}

export async function updateVehicleAction(id: string, input: VehicleInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_vehicles").update(clean(input)).eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}

// 처분·반납한 차량은 삭제 대신 사용 안 함(지난 결의서 연결 보존)
export async function setVehicleActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_vehicles").update({ is_active: active }).eq("id", id).select("id");
  if (error) return { error: errorMessage(error) };
  if (!data?.length) return { error: messageForDbError({ message: "NOT_FOUND" }) };
  refresh();
  return { error: null };
}
