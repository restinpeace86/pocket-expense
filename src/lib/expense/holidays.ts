import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 공휴일 표(kr_holidays, D-161) — 청구 마감을 영업일로 당길 때 쓴다. 요청마다 한 번만 읽는다
export const getHolidays = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const from = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from("kr_holidays").select("day").gte("day", from).order("day");
  return (data ?? []).map((r) => r.day);
});
