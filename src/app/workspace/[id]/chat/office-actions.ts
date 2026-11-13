"use server";

import { after } from "next/server";
import { messageForDbError } from "@/lib/errors";
import { notifyOfficeAnswered } from "@/lib/notify/dispatch";
import { createClient } from "@/lib/supabase/server";

// 세무 알림방 카드 버튼(D-269): [확인했어요] · [문의 남기기](한 번 보내는 회신 = 요청 답변). 권한은 DB 함수(회사 대표·관리자)
type Result = { ok: true; name?: string } | { ok: false; error: string };

export async function ackOfficeRequestAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("company_ack_tax_request", { p_id: id });
  if (error) return { ok: false, error: messageForDbError(error) };
  const { data } = await supabase.from("tax_office_requests").select("acked_by_name").eq("id", id).maybeSingle();
  return { ok: true, name: data?.acked_by_name ?? undefined };
}

export async function replyOfficeRequestAction(id: string, text: string): Promise<Result> {
  const body = text.trim();
  if (!body) return { ok: false, error: "남길 말을 적어 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_tax_office_request", { p_id: id, p_answer: body.slice(0, 500) });
  if (error) return { ok: false, error: messageForDbError(error) };
  const { data: r } = await supabase.from("tax_office_requests").select("company_id, month").eq("id", id).maybeSingle();
  if (r) after(() => notifyOfficeAnswered(r.company_id, r.month, body));
  return { ok: true };
}
