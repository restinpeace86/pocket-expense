import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { fullTimeLabel, KIND_LABEL, kstDateOf, type CalEvent } from "@/lib/calendar/calendar";
import { createClient } from "@/lib/supabase/server";

// 결의서에 연결된 일정(D-210): "📅 연결된 일정 · 출장 · 11월 15일 (토) ~ 11월 16일 (일) 종일 · 부산 거래처 방문"
// 결의서를 볼 수 있는 사람만(결의서 읽기는 RLS) + 캘린더가 켜진 회사만(calendar_event가 확인). 없으면 아무것도 안 그림
export async function ClaimEventLink({ companyId, claimId }: { companyId: string; claimId: string }) {
  const supabase = await createClient();
  const { data: claim } = await supabase.from("expense_claims").select("calendar_event_id").eq("id", claimId).eq("company_id", companyId).maybeSingle();
  if (!claim?.calendar_event_id) return null;
  const { data, error } = await supabase.rpc("calendar_event", { p_id: claim.calendar_event_id });
  if (error || !data) return null;
  const e = data as unknown as CalEvent;
  const day = e.all_day ? e.start_date : e.starts_at ? kstDateOf(e.starts_at) : null;
  return (
    <Link
      href={`/workspace/${companyId}/calendar?${day ? `date=${day}&` : ""}event=${e.id}`}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 hover:bg-brand-100"
    >
      <CalendarDays className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">연결된 일정</span> · {KIND_LABEL[e.kind]} · {fullTimeLabel(e)}
        <span className="block truncate font-medium">{e.title}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-brand-700" />
    </Link>
  );
}
