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
