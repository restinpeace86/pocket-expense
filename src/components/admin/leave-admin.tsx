"use client";

import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { confirmLeaveAction as confirmLeaveActionRaw, saveLeaveSettingsAction as saveLeaveSettingsActionRaw, setHireDateAction as setHireDateActionRaw, type LeaveConfirmItem } from "@/app/workspace/[id]/admin/attendance-settings/leave/actions";
import { buildLeaveRows, daysLabel, ROUNDING_LABEL, type LeaveAdminData, type LeaveRow, type LeaveSettings, type LeaveStatus } from "@/lib/attendance/leave";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const confirmLeaveAction = guarded(confirmLeaveActionRaw);
const saveLeaveSettingsAction = guarded(saveLeaveSettingsActionRaw);
const setHireDateAction = guarded(setHireDateActionRaw);

// 직원별 연차(D-240, spec/features/attendance.md §7-2): 연도 · 연도 기준 · 시간차 · 소수점 · 직원 목록(법 기준 추천·확정·계산 근거) · 확정 창
const card = "rounded-2xl border border-zinc-200 bg-white";
const STATUS: Record<LeaveStatus, { text: (r: LeaveRow, h: number) => string; cls: string }> = {
  unconfirmed: { text: () => "확정 전", cls: "bg-amber-100 text-amber-900" },
  direct: { text: () => "확정 전 · 직접 정해요", cls: "bg-amber-100 text-amber-900" },
  no_hire: { text: () => "입사일 없음", cls: "bg-amber-100 text-amber-900" },
  confirmed: { text: () => "확정", cls: "bg-green-100 text-green-800" },
  above: { text: (r, h) => `추천보다 ${daysLabel(r.grant!.granted - r.rec.days!, h)} 많음`, cls: "bg-indigo-100 text-indigo-800" },
  below: { text: (r, h) => `법 기준보다 ${daysLabel(r.rec.days! - r.grant!.granted, h)} 적음`, cls: "bg-red-100 text-red-800" },
  grown: { text: () => "추천이 늘었어요 · 다시 확정", cls: "bg-amber-100 text-amber-900" },
};
const WHY: Record<string, string> = {
  owner: "대상 아님(사업주)",
  under_five: "5인 미만 · 직접",
  no_hire: "입사일 필요",
  not_yet: "입사 전",
};

export function LeaveAdmin({ data, base }: { data: LeaveAdminData; base: string }) {
  const router = useRouter();
  const rows = useMemo(() => buildLeaveRows(data), [data]);
  const h = data.settings.daily_hours;
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = rows.find((r) => r.member.id === editId) ?? null;

  const batch = rows.filter((r) => r.rec.days !== null && (r.status === "unconfirmed" || r.status === "grown"));
  const confirmAll = () =>
    start(async () => {
      setError(null);
      const items: LeaveConfirmItem[] = batch.map((r) => ({ member_id: r.member.id, period_start: r.rec.periodStart, period_end: r.rec.periodEnd, recommended: r.rec.days, granted: r.rec.days!, reason: null }));
      const res = await confirmLeaveAction(items);
      if (!res.ok) return setError(res.error ?? null);
      router.refresh();
    });

  const counts = { confirmed: rows.filter((r) => ["confirmed", "above", "below"].includes(r.status)).length, pending: rows.filter((r) => ["unconfirmed", "direct", "grown"].includes(r.status)).length, noHire: rows.filter((r) => r.status === "no_hire").length };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto flex items-center">
          <Link href={`?year=${data.year - 1}`} aria-label="이전 해" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
            <ChevronLeft className="size-5" />
          </Link>
          <b className="min-w-20 text-center text-[17px]">{data.year}년</b>
          <Link href={`?year=${data.year + 1}`} aria-label="다음 해" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      <section className={`${card} px-4 py-3.5 text-sm leading-relaxed text-zinc-800 md:px-5`} aria-label="우리 회사 연도 기준">
        <b>우리 회사 연도 기준: {data.settings.basis === "calendar" ? "1월 1일~12월 31일(회계연도)" : "직원별 입사일"}</b>{" "}
        <Link href={`${base}/attendance-settings`} className="text-[13px] text-brand-700 hover:underline">
          근무 기준에서 바꾸기
        </Link>
        <span className="block text-[13px] text-zinc-600">
          {data.settings.basis === "calendar"
            ? `${data.year}년 1월 1일~12월 31일에 쓰는 연차예요. 입사 다음 해에는 근무한 날만큼 나눠서(비례) 줘요.`
            : `${data.year}년에 시작하는 각 직원의 연차 연도(입사한 날부터 1년)예요.`}
        </span>
        {data.settings.under_five && (
          <span className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-950">근무 기준에서 &quot;5인 미만 회사&quot;로 되어 있어요. 근로기준법 제60조가 적용되지 않아 추천값 없이 회사가 직접 정해요.</span>
        )}
      </section>

      <LeaveSettingsCard settings={data.settings} />

      <section className={`${card} overflow-hidden`} aria-label="직원별 연차">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
          <b className="text-[15px]">직원 {rows.length}명</b>
          <span className="text-[13px] text-zinc-600">
            확정 {counts.confirmed} · 확정 전 {counts.pending} · 입사일 없음 {counts.noHire}
          </span>
          {batch.length > 0 && (
            <button type="button" onClick={confirmAll} disabled={busy} className="ml-auto flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-confirm-all>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              추천값으로 모두 확정 ({batch.length}명)
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="px-4 pb-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <ul className="border-t border-zinc-100">
          {rows.map((r) => {
            const st = STATUS[r.status];
            const open = openId === r.member.id;
            return (
              <li key={r.member.id} className="border-b border-zinc-100 last:border-b-0" data-member={r.member.id} data-status={r.status}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:grid md:grid-cols-[9rem_7.5rem_6rem_minmax(0,1fr)_6rem_auto_auto] md:gap-4">
                  <b className="text-[15px]">
                    {r.member.name}
                    {r.member.role !== "employee" && <span className="ml-1 text-xs font-normal text-zinc-500">{r.member.role === "super_admin" ? "대표" : "관리자"}</span>}
                  </b>
                  <span className="text-sm text-zinc-700">
                    {r.member.hire_date ?? (
                      <button type="button" onClick={() => setEditId(r.member.id)} className="font-semibold text-brand-700 hover:underline">
                        입사일을 넣어 주세요
                      </button>
                    )}
                  </span>
                  <span className="text-sm text-zinc-600">{r.rec.service}</span>
                  <button type="button" onClick={() => setOpenId(open ? null : r.member.id)} disabled={r.rec.days === null} aria-expanded={open} className="flex items-center gap-1 text-left text-sm disabled:cursor-default" data-rec>
                    {r.rec.days === null ? (
                      <span className="text-zinc-500">{WHY[r.rec.why] ?? "—"}</span>
                    ) : (
                      <>
                        <span className="text-zinc-500 md:hidden">추천</span>
                        <b>{daysLabel(r.rec.days, h)}</b>
                        <ChevronDown className={`size-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                        {r.rec.nextAccrual && <span className="text-xs text-zinc-500">· 다음 1일 {r.rec.nextAccrual.slice(5).replace("-", "/")}</span>}
                      </>
                    )}
                  </button>
                  <span className="text-sm">
                    <span className="text-zinc-500 md:hidden">확정 </span>
                    {r.grant ? <b className="text-[15px]">{daysLabel(r.grant.granted, h)}</b> : <span className="text-zinc-400">—</span>}
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text(r, h)}</span>
                  <button type="button" onClick={() => setEditId(r.member.id)} className="ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:ml-0" data-edit>
                    {r.grant ? "수정" : "확정"}
                  </button>
                </div>
                {open && <Why row={r} h={h} />}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-xs leading-relaxed text-zinc-600">추천값은 법 기준을 계산한 참고값이에요. 확정·수정·입사일·시간차 설정은 모두 근태 정책의 [변경 이력]에 남아요. 직원 화면의 남은 연차는 휴가 신청 기능에서 열려요.</p>

      {editing && <EditSheet row={editing} h={h} hourly={data.settings.hourly_leave} today={data.today} onClose={() => setEditId(null)} />}
    </div>
  );
}

function Why({ row, h }: { row: LeaveRow; h: number }) {
  const r = row.rec;
  return (
    <div className="px-4 pb-4" data-why>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 text-[13px] leading-relaxed text-zinc-800">
        <b className="text-indigo-800">왜 {daysLabel(r.days!, h)}인가요?</b> <span className="text-zinc-600">· 입사 {row.member.hire_date} · 쓸 수 있는 기간 {r.periodStart} ~ {r.periodEnd}</span>
        <ol className="mt-1 space-y-0.5">
          {r.steps.map((s, i) => (
            <li key={i}>
              {s.text} {s.law && <span className="font-semibold text-indigo-700">({s.law})</span>}
            </li>
          ))}
        </ol>
        <p className="mt-1">
          = <b>{daysLabel(r.days!, h)}</b> {r.months.length === 0 && "(최대 25일)"}
        </p>
        {r.months.length > 0 && (
          <div className="mt-2 border-t border-indigo-100 pt-2" data-months>
            <b>달마다 개근 참고(우리 앱 출퇴근 기록)</b>
            <span className="block text-xs text-zinc-600">기록 없는 날이 곧 결근은 아니에요(외근·휴가·정정 대기일 수 있어요). 개근 여부는 회사가 판단해요.</span>
            <ul className="mt-1 space-y-0.5">
              {r.months.map((m) => (
                <li key={m.n} data-month-state={m.state}>
                  {m.from.slice(5).replace("-", "/")} ~ {m.to.slice(5).replace("-", "/")} → {m.accrual.slice(5).replace("-", "/")}에 1일 ·{" "}
                  {m.state === "ok" && <span className="font-semibold text-green-800">근무일 {m.workdays}일 · 출근 기록 {m.recorded}일 → 기록상 개근</span>}
                  {m.state === "check" && (
                    <span className="font-semibold text-amber-800">
                      근무일 {m.workdays}일 · 출근 기록 {m.recorded}일 → 확인 필요({m.missing.slice(0, 4).map((d) => d.slice(5).replace("-", "/")).join(", ")}
                      {m.missing.length > 4 ? ` 외 ${m.missing.length - 4}일` : ""} 기록 없음)
                    </span>
                  )}
                  {m.state === "noapp" && <span className="text-zinc-500">앱 사용 전이라 기록 없음</span>}
                  {m.state === "future" && <span className="text-zinc-500">아직 안 생김</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaveSettingsCard({ settings }: { settings: LeaveSettings }) {
  const router = useRouter();
  const [hourly, setHourly] = useState(settings.hourly_leave);
  const [rounding, setRounding] = useState(settings.rounding);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prev, setPrev] = useState({ h: settings.hourly_leave, r: settings.rounding });
  if (prev.h !== settings.hourly_leave || prev.r !== settings.rounding) {
    setPrev({ h: settings.hourly_leave, r: settings.rounding });
    setHourly(settings.hourly_leave);
    setRounding(settings.rounding);
  }
  const save = (nextHourly: boolean, nextRounding: LeaveSettings["rounding"]) => {
    const r = !nextHourly && nextRounding === "hour" ? "day" : nextRounding;
    setHourly(nextHourly);
    setRounding(r);
    start(async () => {
      const res = await saveLeaveSettingsAction(nextHourly, r);
      setMsg(res.ok ? { ok: true, text: "저장했어요. 변경 이력에 남았어요." } : { ok: false, text: res.error ?? "저장하지 못했어요." });
      if (res.ok) router.refresh();
    });
  };
  return (
    <section className={`${card} flex flex-col gap-4 px-4 py-4 md:px-5`} aria-label="연차 설정">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <b className="text-[15px]">시간차 허용</b>
          <p className="text-[13px] leading-relaxed text-zinc-600">켜면 직원이 연차를 1시간 단위로 써요(1일 = 하루 소정근로 {settings.daily_hours}시간). 2시간이면 반반차, 4시간이면 반차예요.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hourly}
          aria-label="시간차 허용"
          disabled={busy}
          onClick={() => save(!hourly, rounding)}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${hourly ? "bg-brand-600" : "bg-zinc-300"}`}
        >
          <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${hourly ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[15px] font-bold">비례 연차 소수점</legend>
        <p className="text-[13px] leading-relaxed text-zinc-600">
          회계연도 기준이면 입사 다음 해에 &quot;15일 × 근무한 날 ÷ 365&quot;처럼 소수점이 생겨요(예: 1.81일). 소수점을 버리면 직원에게 불리해 법 위반 소지가 있어서 <b>올림만</b> 골라요. 고른 방식은 취업규칙에도 적어 두세요.
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="비례 연차 소수점">
          {(["day", "half", "hour"] as const).map((k) => {
            const off = k === "hour" && !hourly;
            const ex = k === "day" ? "1.81일 → 2일" : k === "half" ? "1.81일 → 2일 · 1.3일 → 1.5일" : `1.81일 → ${Math.ceil(1.81 * settings.daily_hours)}시간`;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={rounding === k}
                disabled={busy || off}
                onClick={() => save(hourly, k)}
                className={`flex min-h-11 flex-col items-start rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-50 ${rounding === k ? "border-brand-600 bg-brand-50 font-semibold text-brand-900" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`}
              >
                {ROUNDING_LABEL[k]}
                {k === "day" && " (기본)"}
                <span className="text-xs font-normal text-zinc-600">{off ? "시간차를 켜면 고를 수 있어요" : ex}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-800" : "font-semibold text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

function EditSheet({ row, h, hourly, today, onClose }: { row: LeaveRow; h: number; hourly: boolean; today: string; onClose: () => void }) {
  const router = useRouter();
  const rec = row.rec.days;
  const init = row.grant?.granted ?? rec ?? 15;
  const [daysWhole, setDaysWhole] = useState(String(Math.floor(init + 1e-9)));
  const [hours, setHours] = useState(String(Math.round((init - Math.floor(init + 1e-9)) * h)));
  const [reason, setReason] = useState(row.grant?.reason ?? "");
  const [hire, setHire] = useState(row.member.hire_date ?? "");
  const [hireReason, setHireReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const granted = Number(daysWhole || 0) + (hourly ? Number(hours || 0) / h : 0);
  const below = rec !== null && granted < rec - 1e-9;
  const hireChanged = hire !== (row.member.hire_date ?? "");
  const canGrant = row.rec.why !== "no_hire" && !hireChanged;

  const saveHire = () =>
    start(async () => {
      setError(null);
      if (!hire) return setError("입사일을 넣어 주세요.");
      if (!hireReason.trim()) return setError("입사일을 바꾸는 사유를 적어 주세요.");
      const res = await setHireDateAction(row.member.id, hire, hireReason.trim());
      if (!res.ok) return setError(res.error ?? null);
      onClose();
      router.refresh();
    });
  const saveGrant = () =>
    start(async () => {
      setError(null);
      if (!Number.isFinite(granted) || granted < 0 || granted > 60) return setError("연차 일수는 0~60일 사이로 넣어 주세요.");
      if (below && !reason.trim()) return setError("법 기준보다 적게 정하는 사유를 적어 주세요.");
      const res = await confirmLeaveAction([{ member_id: row.member.id, period_start: row.rec.periodStart, period_end: row.rec.periodEnd, recommended: rec, granted, reason: reason.trim() || null }]);
      if (!res.ok) return setError(res.error ?? null);
      onClose();
      router.refresh();
    });

  const input = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="leave-edit-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl">
        <div className="flex items-center">
          <h2 id="leave-edit-title" className="text-lg font-bold">
            {row.member.name} · {row.rec.periodStart.slice(0, 4)}년 연차
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="leave-hire" className="text-sm font-semibold">
            입사일
          </label>
          <input id="leave-hire" type="date" max={today} value={hire} onChange={(e) => setHire(e.target.value)} className={input} />
          {hireChanged && (
            <>
              <label htmlFor="leave-hire-reason" className="text-sm font-semibold">
                입사일을 바꾸는 사유 <span className="text-red-700">(필수)</span>
              </label>
              <input id="leave-hire-reason" value={hireReason} maxLength={200} onChange={(e) => (setHireReason(e.target.value), setError(null))} placeholder="예: 근로계약서 확인 — 첫 출근일 11/4" className={input} />
              <p className="text-xs leading-relaxed text-zinc-600">바꾸면 변경 이력(누가·언제·이전→이후·사유)에 남고, {row.member.role === "super_admin" ? "" : "직원에게 [알림]방으로 알려요. "}입사일을 먼저 저장한 뒤 연차를 확정해요.</p>
              <button type="button" onClick={saveHire} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-save-hire>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                입사일 저장
              </button>
            </>
          )}
        </div>

        {canGrant && (
          <>
            {rec !== null ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-indigo-950">
                <b>법 기준 추천 {daysLabel(rec, h)}</b> · {row.rec.periodStart} ~ {row.rec.periodEnd}
                {row.rec.steps.map((s, i) => (
                  <span key={i} className="block">
                    · {s.text} {s.law && `(${s.law})`}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-700">
                {row.rec.why === "owner" ? "대표(사업주)는 근로자가 아니어서 법 연차 대상이 아니에요. 회사가 직접 정해요." : row.rec.why === "under_five" ? "5인 미만 회사는 근로기준법 제60조가 적용되지 않아 회사가 직접 정해요." : "이 해에는 입사 전이에요."}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">확정 일수</span>
              <div className="flex items-center gap-2">
                <input aria-label="확정 일수(일)" inputMode="numeric" value={daysWhole} onChange={(e) => (setDaysWhole(e.target.value.replace(/\D/g, "").slice(0, 2)), setError(null))} className={`${input} w-24 text-lg font-bold ${below ? "border-red-500" : ""}`} />
                <span>일</span>
                {hourly && (
                  <>
                    <input aria-label="확정 일수(시간)" inputMode="numeric" value={hours} onChange={(e) => setHours(String(Math.min(h - 1, Number(e.target.value.replace(/\D/g, "") || 0))))} className={`${input} w-20 text-lg font-bold ${below ? "border-red-500" : ""}`} />
                    <span>시간</span>
                  </>
                )}
              </div>
            </div>
            {below && (
              <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-900" data-below-warning>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <b>법 기준({daysLabel(rec!, h)})보다 {daysLabel(rec! - granted, h)} 적어요.</b> 상시 5명 이상 회사는 법 기준보다 적게 주면 안 돼요. 출근율이 80% 미만인 경우처럼 사유가 있을 때만 적게 정하고, 사유를 남겨 주세요.
                </span>
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="leave-reason" className="text-sm font-semibold">
                사유 {below ? <span className="text-red-700">(필수)</span> : <span className="font-normal text-zinc-500">(선택)</span>}
              </label>
              <textarea id="leave-reason" rows={2} maxLength={200} value={reason} onChange={(e) => (setReason(e.target.value), setError(null))} placeholder={below ? "예: 무단결근이 많아 출근율 80% 미만(노무사 확인)" : "예: 회사 규정으로 1일 더"} className="rounded-xl border border-zinc-300 px-3 py-2.5 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
            </div>
            <button type="button" onClick={saveGrant} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-save-grant>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {daysLabel(granted, h)}로 확정
            </button>
            <p className="text-center text-xs text-zinc-600">확정하면 변경 이력에 남아요(누가·언제·이전→이후·사유).</p>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
