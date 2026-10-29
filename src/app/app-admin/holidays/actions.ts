"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";

// 공휴일 표 (D-161): 청구·세무 마감을 영업일로 당길 때 쓰는 날짜. 운영자가 해마다 확인·추가(운영자 화면 쓰기 예외, D-080 보완)
type Result = { ok: true } | { ok: false; error: string };

export async function addHolidayAction(day: string, name: string): Promise<Result> {
  const ok = await getAppAdmin();
  if (!ok) return { ok: false, error: "운영자만 바꿀 수 있어요." };
  const n = name.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { ok: false, error: "날짜를 골라 주세요." };
  if (!n || n.length > 40) return { ok: false, error: "이름은 1~40자로 써 주세요." };
  const { error } = await ok.admin.from("kr_holidays").upsert({ day, name: n });
  if (error) return { ok: false, error: "저장하지 못했어요." };
  refresh();
  return { ok: true };
}

export async function deleteHolidayAction(day: string): Promise<Result> {
  const ok = await getAppAdmin();
  if (!ok) return { ok: false, error: "운영자만 바꿀 수 있어요." };
  const { error } = await ok.admin.from("kr_holidays").delete().eq("day", day);
  if (error) return { ok: false, error: "지우지 못했어요." };
  refresh();
  return { ok: true };
}
