"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createLeaveAction } from "@/app/workspace/[id]/employee/vacation/actions";
import { daysLabel } from "@/lib/attendance/leave";
import { dayLabel } from "@/lib/attendance/month";
import type { ProcessedProof } from "@/lib/attendance/proof-image";
import { PAID_LABEL, preview, type VacationData } from "@/lib/attendance/vacation";
import { ProofPicker, uploadProofs } from "./proof-picker";

// 휴가 신청(spec/features/attendance.md §8-3, D-241): 종류 → 단위 → 날짜 → 미리 보기(근무일·남은 연차) → 사유(선택) → 증빙(필수 종류)
export function VacationForm({ data, back, companyId, memberId }: { data: VacationData; back: string; companyId: string; memberId: string }) {
  const router = useRouter();
  const h = data.settings.daily_hours;
  const monthStart = `${data.today.slice(0, 7)}-01`;
  const [typeId, setTypeId] = useState(data.types[0]?.id ?? "");
  const [more, setMore] = useState(false);
  const type = data.types.find((t) => t.id === typeId);
  const hoursOk = !!type?.allow_hours && (type.key !== "annual" || data.settings.hourly_leave);
  const [unit, setUnit] = useState<"day" | "hour">("day");
  const u = hoursOk ? unit : "day";
  const [start, setStart] = useState(data.today);
  const [end, setEnd] = useState(data.today);
  const [startTime, setStartTime] = useState("14:00");
  const [hours, setHours] = useState(Math.floor(h / 2));
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<ProcessedProof[]>([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start_] = useTransition();
  const p = useMemo(() => preview(data, { typeId, unit: u, start, end: u === "hour" ? start : end, startTime, hours, reason }, monthStart), [data, typeId, u, start, end, startTime, hours, reason, monthStart]);
  const quick = data.types.slice(0, 4);
  const rest = data.types.slice(4);

  const submit = () =>
    start_(async () => {
      setError(null);
      if (p.error) return setError(p.error);
      if (files.length && !consent) return setError("증빙을 올리려면 민감정보 수집·이용에 동의해 주세요.");
      const r = await createLeaveAction({ type_id: typeId, unit: u, start_date: start, end_date: u === "hour" ? start : end, start_time: u === "hour" ? startTime : null, hours: u === "hour" ? hours : null, reason: reason.trim() || null });
      if (!r.ok) return setError(r.error);
      let flash = r.selfApproved ? "self" : "pending";
      if (files.length) {
        const failed = await uploadProofs(companyId, memberId, r.id, files, consent);
        if (failed.length) flash = "proof";
      } else if (type?.proof === "required") flash = "proof";
      router.replace(`${back}?year=${start.slice(0, 4)}&done=${flash}`);
      router.refresh();
    });

  const chip = (on: boolean) => `h-10 rounded-full border px-3.5 text-[13px] ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`;
  const input = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

  return (
    <div className="mx-auto w-full max-w-md md:pt-4">
      <header className="flex h-14 items-center gap-1 border-b border-zinc-200 bg-white px-2">
        <Link href={back} aria-label="뒤로" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-[17px] font-bold">휴가 신청</h1>
      </header>
      <main className="flex flex-col gap-4 px-4 pb-40 pt-4">
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
            <div className="flex gap-1.5" role="radiogroup" aria-label="단위">
              <button type="button" role="radio" aria-checked={u === "day"} onClick={() => setUnit("day")} className={chip(u === "day")}>
                하루 이상
              </button>
              <button type="button" role="radio" aria-checked={u === "hour"} onClick={() => setUnit("hour")} className={chip(u === "hour")}>
                시간
              </button>
            </div>
          </div>
        )}

        {u === "day" ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">시작하는 날</span>
              <input type="date" min={monthStart} value={start} onChange={(e) => (setStart(e.target.value), end < e.target.value && setEnd(e.target.value))} className={input} aria-label="시작하는 날" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">끝나는 날</span>
              <input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} className={input} aria-label="끝나는 날" />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">날짜</span>
              <input type="date" min={monthStart} value={start} onChange={(e) => setStart(e.target.value)} className={input} aria-label="날짜" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">시작</span>
              <input type="time" step={600} value={startTime} onChange={(e) => setStartTime(e.target.value)} className={input} aria-label="시작 시각" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">시간</span>
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={input} aria-label="시간">
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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={submit} disabled={busy || !!p.error} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-submit-vacation>
            {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
            휴가 신청 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
