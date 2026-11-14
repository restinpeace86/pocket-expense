"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createLeaveAction as createLeaveActionRaw } from "@/app/workspace/[id]/employee/vacation/actions";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { daysLabel } from "@/lib/attendance/leave";
import { dayLabel } from "@/lib/attendance/month";
import type { ProcessedProof } from "@/lib/attendance/proof-image";
import { halfDayStart, leaveMarks, offDayReason, PAID_LABEL, preview, workdaysBetween, yearSummary, type VacationData } from "@/lib/attendance/vacation";
import type { LeaveInputs } from "@/lib/company-forms/leave-inputs";
import { LeaveCustomFields, missingRequired } from "./leave-custom-fields";
import { ProofPicker, uploadProofs } from "./proof-picker";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const createLeaveAction = guarded(createLeaveActionRaw);

// 휴가 신청(spec/features/attendance.md §8-3, D-241): 종류 → 단위 → 날짜 → 미리 보기(근무일·남은 연차) → 사유(선택) → 증빙(필수 종류)
// D-257: [휴가 및 근태 신청] 위로 올라오는 창(휴대폰은 위쪽 남은 연차 줄이 보이게 거의 전체 높이, PC는 가운데)
// D-258: 날짜는 달력(시작일·끝일 두 번 누르기, 쉬는 날 흐리게, 낸 휴가 점), 반차는 [오전 반차]·[오후 반차](정규 출퇴근 시각으로 채움)
export function VacationForm({
  data,
  companyId,
  memberId,
  custom = null,
  work = { start: "09:00", end: "18:00" },
  onClose,
  onDone,
}: {
  data: VacationData;
  work?: { start: string; end: string }; // 회사 정규 출퇴근 시각(반차 시작 시각)
  companyId: string;
  memberId: string;
  custom?: LeaveInputs | null;
  onClose: () => void;
  onDone: (flash: string, year: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => custom?.last ?? {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const h = data.settings.daily_hours;
  const monthStart = `${data.today.slice(0, 7)}-01`;
  const [typeId, setTypeId] = useState(data.types[0]?.id ?? "");
  const [more, setMore] = useState(false);
  const type = data.types.find((t) => t.id === typeId);
  const hoursOk = !!type?.allow_hours && (type.key !== "annual" || data.settings.hourly_leave);
  const [mode, setMode] = useState<"day" | "am" | "pm" | "hour">("day");
  const m = hoursOk ? mode : "day";
  const u = m === "day" ? "day" : "hour";
  const half = Math.floor(h / 2);
  const [start, setStart] = useState(data.today);
  const [end, setEnd] = useState(data.today);
  const [time, setStartTime] = useState("14:00");
  const [hrs, setHours] = useState(half);
  const startTime = m === "am" || m === "pm" ? halfDayStart(m, work, half) : time;
  const hours = m === "am" || m === "pm" ? half : hrs;
  const marks = useMemo(() => leaveMarks(data.leaves), [data.leaves]);
  const off = useMemo(() => {
    const hol = new Set(data.holidays);
    return (d: string) => offDayReason(d, data.settings.work_days, hol);
  }, [data.holidays, data.settings.work_days]);
  const workdayCount = (a: string, b: string) => `근무일 ${workdaysBetween(a, b, data.settings.work_days, new Set(data.holidays))}일`;
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<ProcessedProof[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start_] = useTransition();
  const p = useMemo(() => preview(data, { typeId, unit: u, start, end: u === "hour" ? start : end || start, startTime, hours, reason }, monthStart), [data, typeId, u, start, end, startTime, hours, reason, monthStart]);
  const left = yearSummary(data).remaining; // 창 머리에 남은 연차(목록 위 숫자가 창에 가려도 보이게)
  const quick = data.types.slice(0, 4);
  const rest = data.types.slice(4);

  const submit = () =>
    start_(async () => {
      setError(null);
      if (p.error) return setError(p.error);
      if (files.length && !consent) return setError("증빙을 올리려면 민감정보 수집·이용에 동의해 주세요.");
      const miss = custom ? missingRequired(custom.fields, values) : null;
      if (miss) return setError(`회사 추가 항목 [${miss.label}]을(를) 채워 주세요.`);
      const r = await createLeaveAction({ type_id: typeId, unit: u, start_date: start, end_date: u === "hour" ? start : end || start, start_time: u === "hour" ? startTime : null, hours: u === "hour" ? hours : null, reason: reason.trim() || null, ...(custom ? { custom: values } : {}) });
      if (!r.ok) return setError(r.error);
      let flash = r.selfApproved ? "self" : "pending";
      if (files.length) {
        const failed = await uploadProofs(companyId, memberId, r.id, files, consent);
        if (failed.length) flash = "proof";
      } else if (type?.proof === "required") flash = "proof";
      onDone(flash, start.slice(0, 4));
    });

  const chip = (on: boolean) => `h-10 rounded-full border px-3.5 text-[13px] ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`;
  const input = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="vacation-new-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[calc(100dvh-7.5rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-[90dvh] md:rounded-3xl" data-vacation-sheet>
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-200 px-3">
        <h2 id="vacation-new-title" className="pl-2 text-[17px] font-bold">휴가 신청</h2>
        {left !== null && (
          <span className="ml-1 rounded-full bg-brand-50 px-2.5 py-1 text-[13px] font-semibold text-brand-800" data-sheet-balance>
            남은 연차 {left < 0 ? `−${daysLabel(-left, h)}` : daysLabel(left, h)}
          </span>
        )}
        <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
          <X className="size-5" />
        </button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">종류</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="휴가 종류">
            {(more ? data.types : quick).map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={typeId === t.id} onClick={() => (setTypeId(t.id), setFiles([]), setConsent(false))} className={chip(typeId === t.id)}>
                {t.name}
              </button>
            ))}
            {!more && rest.length > 0 && (
              <button type="button" onClick={() => setMore(true)} className={chip(false)}>
                더 보기 ▾
              </button>
            )}
          </div>
          {type && (
            <span className="text-xs text-zinc-600" data-type-info>
              {type.name} · {PAID_LABEL[type.paid]} · {type.deducts ? "남은 연차에서 빠져요" : "연차에서 빠지지 않아요"}
              {type.proof === "required" && " · 증빙 필수"}
            </span>
          )}
        </div>

        {hoursOk && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">단위</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="단위">
              {(
                [
                  ["day", "하루 이상"],
                  ["am", "오전 반차"],
                  ["pm", "오후 반차"],
                  ["hour", "시간"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => (setMode(k), k !== "day" && setEnd(start))} className={chip(m === k)} data-unit={k}>
                  {label}
                </button>
              ))}
            </div>
            {(m === "am" || m === "pm") && (
              <span className="text-xs text-zinc-600" data-half-time>
                {startTime}부터 {half}시간 · 회사 정규 출퇴근 시각({work.start}~{work.end}) 기준이에요. 다르면 [시간]에서 골라요.
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5" data-vacation-calendar>
          <DateRangePicker
            inline
            single={u === "hour"}
            label="날짜"
            min={monthStart}
            start={start}
            end={u === "hour" ? start : end}
            off={off}
            marks={marks}
            count={(a, b) => (m === "am" ? "오전 반차" : m === "pm" ? "오후 반차" : m === "hour" ? `${startTime}부터 ${hours}시간` : workdayCount(a, b))}
            onChange={(a, b) => (setStart(a), setEnd(b))}
          />
          <span className="flex flex-wrap gap-x-3 text-xs text-zinc-600">
            <span>
              <span className="mr-1 inline-block size-1.5 rounded-full bg-amber-500 align-middle" aria-hidden />
              이미 낸 휴가
            </span>
            <span>흐린 날은 쉬는 날(주말·공휴일)</span>
          </span>
        </div>

        {m === "hour" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">시작</span>
              <input type="time" step={600} value={time} onChange={(e) => setStartTime(e.target.value)} className={input} aria-label="시작 시각" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">시간</span>
              <select value={hrs} onChange={(e) => setHours(Number(e.target.value))} className={input} aria-label="시간">
                {Array.from({ length: h - 1 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}시간{n * 2 === h ? "(반차)" : n * 4 === h ? "(반반차)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${p.error ? "bg-red-50 text-red-900" : "bg-indigo-50 text-indigo-950"}`} data-preview>
          {p.workdays > 0 && (
            <>
              이번 신청 <b>{u === "hour" ? `${hours}시간` : `근무일 ${p.workdays}일`}</b>
              {p.skipped.length > 0 && u === "day" && <span> ({p.skipped.map(dayLabel).join(", ")}은 근무일이 아니라 빼고 셌어요)</span>}
              {p.remainingBefore !== null && p.remainingAfter !== null && (
                <span className="block">
                  남은 연차 {daysLabel(Math.max(p.remainingBefore, 0), h)} → <b>{p.remainingAfter < 0 ? `−${daysLabel(-p.remainingAfter, h)}(당겨씀)` : daysLabel(p.remainingAfter, h)}</b>
                </span>
              )}
              {type && !type.deducts && <span className="block">연차에서 빠지지 않아요.</span>}
            </>
          )}
          {p.error && <b className="block">{p.error}</b>}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            사유 <span className="font-normal text-zinc-500">(선택{type?.key === "annual" ? " · 연차는 적지 않아도 돼요" : ""})</span>
          </span>
          <textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type?.key === "annual" ? "비워 둬도 신청돼요" : "예: 본인 결혼 · 병원 진료"} className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
        </label>

        {custom && <LeaveCustomFields formName={custom.formName} fields={custom.fields} values={values} onChange={(k, v) => (setValues((x) => ({ ...x, [k]: v })), setError(null))} members={custom.members} />}

        {type && type.proof !== "none" && (
          <>
            <ProofPicker files={files} onChange={setFiles} consent={consent} onConsent={(v) => (setConsent(v), setError(null))} required={type.proof === "required"} />
            {type.proof === "required" && files.length === 0 && <p className="-mt-2 text-xs text-indigo-800">아직 서류가 없으면 신청부터 하고 나중에 [휴가 및 근태 신청]에서 올려도 돼요. 올리기 전에는 승인되지 않아요.</p>}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-zinc-600">관리자가 승인하면 [알림]방으로 알려 드려요. 승인 전에는 바로 취소할 수 있고, 승인 뒤에는 취소 신청을 해요. 지난 날짜는 이번 달까지만 신청할 수 있어요.</p>
      </main>
      <div className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:pb-4">
        <div>
          <button type="button" onClick={submit} disabled={busy || !!p.error} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-submit-vacation>
            {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
            휴가 신청 보내기
          </button>
        </div>
      </div>
      </section>
    </div>
  );
}
