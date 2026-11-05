"use client";

import { CalendarDays, Check, ChevronDown, Loader2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { KIND_LABEL, shortDayLabel, type CalKind } from "@/lib/calendar/calendar";
import { createClient } from "@/lib/supabase/client";

// 결의서 쓰기 › 출장 정보: 캘린더 출장·외근 일정 불러오기(D-216, spec/features/calendar.md §14)
// - 내가 참석하는 출장·외근(60일 전 ~ 30일 뒤, 가까운 순). 누르면 출장지·기간·목적이 채워지고 결의서에 그 일정이 연결된다
// - 캘린더 등록은 선택 — 일정이 없으면 한 줄 안내만, 캘린더가 꺼진 회사면 아무것도 안 그림
export type TripFill = { destination: string | null; startDate: string; endDate: string; purpose: string };
type TripEvent = { id: string; kind: CalKind; title: string; start_date: string; end_date: string; place: string | null };

const SHOW = 3;
const ERR: Record<string, string> = {
  NOT_ATTENDEE: "내가 참석하는 일정만 불러올 수 있어요.",
  NOT_EDITABLE: "상신한 결의서는 바꿀 수 없어요.",
};

export function TripEventPicker({ claimId, linkedEventId, onFill }: { claimId: string; linkedEventId: string | null; onFill: (f: TripFill) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [list, setList] = useState<TripEvent[] | null>(null);
  const [off, setOff] = useState(false);
  const [linked, setLinked] = useState<string | null>(linkedEventId);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.rpc("calendar_my_trip_events").then(({ data, error }) => {
      if (!alive) return;
      if (error) return setOff(true);
      setList((data as unknown as TripEvent[] | null) ?? []);
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  if (off) return null;
  if (list === null) return <Loader2 className="size-4 animate-spin text-zinc-400" aria-label="캘린더 일정 불러오는 중" />;
  if (!list.length) {
    return <p className="text-xs text-zinc-500">📅 캘린더에 출장·외근을 등록해 두면 여기서 눌러 바로 채울 수 있어요(선택).</p>;
  }

  const pick = async (e: TripEvent) => {
    setBusy(e.id);
    setErr(null);
    const { data, error } = await supabase.rpc("claim_link_calendar_event", { p_claim: claimId, p_event: e.id });
    setBusy(null);
    if (error || !data) return setErr(ERR[Object.keys(ERR).find((k) => error?.message?.includes(k)) ?? ""] ?? "일정을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    const r = data as { destination: string | null; start_date: string; end_date: string; purpose: string };
    setLinked(e.id);
    onFill({ destination: r.destination, startDate: r.start_date, endDate: r.end_date, purpose: r.purpose });
    router.refresh(); // 위쪽 "연결된 일정" 줄
  };
  const unlink = async () => {
    setBusy("unlink");
    setErr(null);
    const { error } = await supabase.rpc("claim_link_calendar_event", { p_claim: claimId, p_event: null as unknown as string });
    setBusy(null);
    if (error) return setErr("연결을 끊지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    setLinked(null);
    router.refresh();
  };

  const shown = all ? list : list.slice(0, SHOW);
  return (
    <section className="flex flex-col gap-1.5" aria-label="캘린더 일정에서 불러오기">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
          <CalendarDays className="size-4 shrink-0 text-brand-600" />
          캘린더 일정에서 불러오기
        </p>
        <p className="text-xs text-zinc-500">누르면 출장지·기간·목적이 채워져요. 일정이 없으면 아래에 직접 적어도 돼요.</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {shown.map((e) => {
          const on = linked === e.id;
          const days = e.start_date === e.end_date ? shortDayLabel(e.start_date) : `${shortDayLabel(e.start_date)} ~ ${shortDayLabel(e.end_date)}`;
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void pick(e)}
                aria-pressed={on}
                className={`flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-60 ${on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
              >
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${e.kind === "trip" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{KIND_LABEL[e.kind]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-zinc-900">{e.title}</span>
                  <span className="block truncate text-xs tabular-nums text-zinc-500">
                    {days}
                    {e.place ? ` · ${e.place}` : ""}
                  </span>
                </span>
                {busy === e.id ? <Loader2 className="size-4 shrink-0 animate-spin text-brand-600" /> : on ? <Check className="size-4 shrink-0 text-brand-600" aria-label="불러옴" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3">
        {list.length > SHOW && (
          <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex min-h-10 items-center gap-1 text-sm text-zinc-600 underline-offset-2 hover:underline">
            <ChevronDown className={`size-4 transition-transform ${all ? "rotate-180" : ""}`} />
            {all ? "접기" : `일정 ${list.length - SHOW}개 더 보기`}
          </button>
        )}
        {linked && (
          <button type="button" disabled={!!busy} onClick={() => void unlink()} className="inline-flex min-h-10 items-center gap-1 text-sm text-zinc-600 underline-offset-2 hover:underline disabled:opacity-60">
            <Unlink className="size-4" />
            일정 연결 끊기
          </button>
        )}
      </div>
      {err && (
        <p role="alert" className="text-sm text-red-700">
          {err}
        </p>
      )}
    </section>
  );
}
