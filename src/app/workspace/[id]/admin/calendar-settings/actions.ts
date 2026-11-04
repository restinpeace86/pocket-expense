"use server";

import { refresh } from "next/cache";
import { saveErrorText } from "@/lib/calendar/calendar";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// 회의실 설정(D-207). 관리자·같은 회사·캘린더 스위치 확인은 DB 함수(calendar_room_*)가 한다
function result(error: { message?: string } | null): ActionResult {
  if (error) return { error: saveErrorText(error.message) };
  refresh();
  return { error: null };
}

export async function saveMeetingRoomAction(id: string | null, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calendar_room_save", { p_id: id as string, p_name: name });
  return result(error);
}

export async function reorderMeetingRoomsAction(ids: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calendar_room_reorder", { p_ids: ids });
  return result(error);
}

export async function deleteMeetingRoomAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calendar_room_delete", { p_id: id });
  return result(error);
}

// 캘린더 켜기·끄기(D-208): 관리자만, 자기 회사만(calendar_set_enabled). 메뉴·홈 카드가 바로 바뀌도록 화면 새로 그림
export async function setCalendarEnabledAction(enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calendar_set_enabled", { p_enabled: enabled });
  return result(error);
}
