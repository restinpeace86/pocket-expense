import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CalDirectory, CalEvent, Holiday } from "./calendar";

// 사내 캘린더 스위치(D-206): 회사별 company_features 'calendar'. 꺼져 있으면 메뉴·주소·홈 카드를 숨긴다
export const calendarEnabled = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_feature_enabled", { p_feature: "calendar" });
  return data === true;
});

// 공휴일 이름까지(달력 빨간 날 + "추석"). 작은 표라 작년부터 앞으로 전부
export const getHolidayList = cache(async (): Promise<Holiday[]> => {
  const supabase = await createClient();
  const from = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from("kr_holidays").select("day, name").gte("day", from).order("day");
  return (data ?? []) as Holiday[];
});

export async function getCalendarDirectory(): Promise<CalDirectory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_directory");
  if (error || !data) return null;
  return data as unknown as CalDirectory;
}

export async function getCalendarEvents(from: string, to: string, memberIds: string[]): Promise<CalEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_events_range", { p_from: from, p_to: to, p_members: memberIds });
  if (error || !data) return [];
  return data as unknown as CalEvent[];
}
