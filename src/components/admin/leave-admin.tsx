"use client";

import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { confirmLeaveAction as confirmLeaveActionRaw, saveLeaveBasisAction as saveLeaveBasisActionRaw, saveLeaveSettingsAction as saveLeaveSettingsActionRaw, setHireDateAction as setHireDateActionRaw, type LeaveConfirmItem } from "@/app/workspace/[id]/admin/attendance-settings/leave/actions";
import { buildLeaveRows, daysLabel, ROUNDING_LABEL, type LeaveAdminData, type LeaveRow, type LeaveSettings, type LeaveStatus } from "@/lib/attendance/leave";
import { ApplyPreview } from "@/components/admin/apply-preview";
import { hirePreview, leaveImpact } from "@/lib/admin/apply-preview";
import { todayKst } from "@/lib/dates";
import { guarded } from "@/lib/action-guard";
import { DefaultBadge } from "@/components/ui/default-badge";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const confirmLeaveAction = guarded(confirmLeaveActionRaw);
const saveLeaveSettingsAction = guarded(saveLeaveSettingsActionRaw);
const saveLeaveBasisAction = guarded(saveLeaveBasisActionRaw);
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

export function LeaveAdmin({ data }: { data: LeaveAdminData; base: string }) {
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

  const [hireBatch, setHireBatch] = useState(false);
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

      <LeaveBasisCard data={data} />

      <LeaveSettingsCard settings={data.settings} />

      {/* U-15(D-308): 입사일이 빠진 직원은 줄마다 경고하지 않고 여기 한 번에 */}
      {counts.noHire > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl sm:flex-row sm:items-center border border-amber-200 bg-amber-50 px-4 py-3" data-hire-missing>
          <p className="min-w-0 flex-1 text-sm text-amber-950">
            <b>
              입사일을 넣은 직원 {rows.length - counts.noHire}/{rows.length}명
            </b>
            <span className="block text-[13px]">입사일이 있어야 연차를 계산해요. 근로계약서의 첫 출근일을 넣어 주세요.</span>
          </p>
          <button type="button" onClick={() => setHireBatch(true)} className="min-h-11 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" data-hire-batch-open>
            입사일 한 번에 넣기 ({counts.noHire}명)
          </button>
        </section>
      )}

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
            const noHire = r.status === "no_hire"; // U-15: 휴대폰에선 빈 칸(—)을 줄줄이 보이지 않게
            return (
              <li key={r.member.id} className="border-b border-zinc-100 last:border-b-0" data-member={r.member.id} data-status={r.status}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:grid md:grid-cols-[9rem_7.5rem_6rem_minmax(0,1fr)_6rem_auto_auto] md:gap-4">
                  <b className="text-[15px]">
                    {r.member.name}
                    {r.member.role !== "employee" && <span className="ml-1 text-xs font-normal text-zinc-500">{r.member.role === "super_admin" ? "대표" : "관리자"}</span>}
                  </b>
                  <span className={`text-sm text-zinc-700 ${noHire ? "max-md:hidden" : ""}`}>
                    {r.member.hire_date ?? <span className="text-zinc-400">—</span>}
                  </span>
                  <span className={`text-sm text-zinc-600 ${noHire ? "max-md:hidden" : ""}`}>{r.rec.service}</span>
                  <button type="button" onClick={() => setOpenId(open ? null : r.member.id)} disabled={r.rec.days === null} aria-expanded={open} className={`flex items-center gap-1 text-left text-sm disabled:cursor-default ${noHire ? "max-md:hidden" : ""}`} data-rec>
                    {r.rec.days === null ? (
                      <span className="text-zinc-500">{r.rec.why === "no_hire" ? "—" : (WHY[r.rec.why] ?? "—")}</span>
                    ) : (
                      <>
                        <span className="text-zinc-500 md:hidden">추천</span>
                        <b>{daysLabel(r.rec.days, h)}</b>
                        <ChevronDown className={`size-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                        {r.rec.nextAccrual && <span className="text-xs text-zinc-500">· 다음 1일 {r.rec.nextAccrual.slice(5).replace("-", "/")}</span>}
                      </>
                    )}
                  </button>
                  <span className={`text-sm ${noHire ? "max-md:hidden" : ""}`}>
                    <span className="text-zinc-500 md:hidden">확정 </span>
                    {r.grant ? <b className="text-[15px]">{daysLabel(r.grant.granted, h)}</b> : <span className="text-zinc-400">—</span>}
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text(r, h)}</span>
                  <button type="button" onClick={() => setEditId(r.member.id)} className="ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:ml-0" data-edit>
                    {r.grant ? "수정" : r.status === "no_hire" ? "입사일 넣기" : "확정"}
                  </button>
                </div>
                {open && <Why row={r} h={h} />}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-xs leading-relaxed text-zinc-600">추천값은 법 기준을 계산한 참고값이에요. 확정·수정·입사일·시간차 설정은 모두 근태 정책의 [변경 이력]에 남아요. 직원 화면의 남은 연차는 휴가 신청 기능에서 열려요.</p>

      {hireBatch && <HireBatchSheet rows={rows.filter((r) => r.status === "no_hire")} onClose={() => setHireBatch(false)} />}
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
                <span className="flex items-center gap-1.5">
                  {ROUNDING_LABEL[k]}
                  {k === "day" && <DefaultBadge />}
                </span>
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

// 입사일로 미리 보기(D-304 B-3): 직접 넣어 봐야 하는 미리보기라 접어 둠. 이 회사 연차 기준으로 올해·내년 추천 연차
function HirePreview({ data }: { data: LeaveAdminData }) {
  const [hire, setHire] = useState("");
  const lines = hire ? hirePreview(hire, data) : null;
  return (
    <details className="group rounded-lg border border-dashed border-zinc-300 px-3 py-2" data-hire-preview>
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" aria-hidden />
        입사일로 미리 보기
      </summary>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-zinc-700">
        입사일
        <input type="date" value={hire} onChange={(e) => setHire(e.target.value)} className="h-10 rounded-lg border border-zinc-300 bg-white px-2 text-[15px]" aria-label="미리 볼 입사일" data-unsaved-ignore />
      </label>
      <div className="mt-2">
        {lines ? <ApplyPreview name="hire" title={`입사일 ${hire}인 직원이면`} lines={lines} /> : <p className="text-[13px] text-zinc-500">날짜를 고르면 이 회사 기준으로 올해·내년 연차를 계산해 보여 줘요. 저장되지 않아요.</p>}
      </div>
    </details>
  );
}

// U-14(D-308): 연차 연도 기준·5인 미만 회사 — 근무 기준에서 이 탭 맨 위로. 바꾸면 달라지는 직원 수(D-304)를 저장 전에 보여 줌
function LeaveBasisCard({ data }: { data: LeaveAdminData }) {
  const router = useRouter();
  const cur = data.settings;
  const [basis, setBasis] = useState(cur.basis);
  const [u5, setU5] = useState(cur.under_five);
  const [prev, setPrev] = useState({ b: cur.basis, u: cur.under_five });
  if (prev.b !== cur.basis || prev.u !== cur.under_five) {
    setPrev({ b: cur.basis, u: cur.under_five });
    setBasis(cur.basis);
    setU5(cur.under_five);
  }
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = !justSaved && (basis !== cur.basis || u5 !== cur.under_five);
  const impact = dirty ? leaveImpact(data, { basis, under_five: u5, daily_hours: cur.daily_hours }) : null;
  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveLeaveBasisAction(basis, u5);
      setMsg(res.ok ? { ok: true, text: "저장했어요. 변경 이력에 남았어요." } : { ok: false, text: res.error ?? "저장하지 못했어요." });
      if (res.ok) {
        setJustSaved(true);
        router.refresh();
      }
    });
  const radio = "flex min-h-10 items-center gap-2 text-[15px]";
  return (
    <section className={`${card} flex flex-col gap-4 px-4 py-4 md:px-5`} aria-label="연차 기준" data-leave-basis>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-[15px] font-bold">연차 연도 기준</legend>
        <p className="text-[13px] leading-relaxed text-zinc-600">직원별 연차 일수를 어떤 1년 단위로 계산할지 정해요.</p>
        <label className={radio}>
          <input type="radio" name="leave-basis" checked={basis === "calendar"} onChange={() => (setBasis("calendar"), setMsg(null), setJustSaved(false))} className="size-4" /> 1월 1일 ~ 12월 31일(회계연도) <DefaultBadge />
        </label>
        <label className={radio}>
          <input type="radio" name="leave-basis" checked={basis === "hire"} onChange={() => (setBasis("hire"), setMsg(null), setJustSaved(false))} className="size-4" /> 직원별 입사일 기준
        </label>
        <span className="text-[13px] text-zinc-600">
          {basis === "calendar" ? `${data.year}년 1월 1일~12월 31일에 쓰는 연차예요. 입사 다음 해에는 근무한 날만큼 나눠서(비례) 줘요.` : `${data.year}년에 시작하는 각 직원의 연차 연도(입사한 날부터 1년)예요.`}
        </span>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-[15px] font-bold">상시 근로자 5인 미만 회사</legend>
        <p className="text-[13px] leading-relaxed text-zinc-600">&apos;예&apos;면 근로기준법 제60조(연차)가 적용되지 않아 추천값 없이 회사가 직접 정해요.</p>
        <div className="flex gap-4">
          <label className={radio}>
            <input type="radio" name="leave-u5" checked={u5} onChange={() => (setU5(true), setMsg(null), setJustSaved(false))} className="size-4" /> 예
          </label>
          <label className={radio}>
            <input type="radio" name="leave-u5" checked={!u5} onChange={() => (setU5(false), setMsg(null), setJustSaved(false))} className="size-4" /> 아니요 <DefaultBadge />
          </label>
        </div>
      </fieldset>
      {impact && (
        <ApplyPreview
          name="leave-impact"
          title="저장하면 우리 회사는"
          lines={
            impact.changed === 0
              ? [`바꿔도 ${data.year}년 추천 연차가 달라지는 직원은 없어요.`]
              : [
                  `직원 ${data.members.length}명 중 ${impact.changed}명의 ${data.year}년 추천 연차가 달라져요.`,
                  `${impact.confirmed > 0 ? `확정해 둔 연차(${impact.confirmed}명)는 지워지지 않아요. ` : ""}저장한 뒤 아래 목록에서 확인해 주세요.`,
                ]
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50" data-leave-basis-save>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          저장
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-800" : "font-semibold text-red-700"}`}>
            {msg.text}
          </p>
        )}
      </div>
      <HirePreview data={data} />
    </section>
  );
}

// U-15(D-308): 입사일 없는 직원을 한 화면에서. 사유는 한 칸(입사일 기록·알림에 함께 남음)
function HireBatchSheet({ rows, onClose }: { rows: LeaveRow[]; onClose: () => void }) {
  const router = useRouter();
  const today = todayKst();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("근로계약서 기준 처음 입력");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const filled = rows.filter((r) => dates[r.member.id]);
  const save = () =>
    start(async () => {
      setError(null);
      if (filled.length === 0) return setError("입사일을 하나 이상 넣어 주세요.");
      if (!reason.trim()) return setError("사유를 적어 주세요.");
      const errs: Record<string, string> = {};
      for (const r of filled) {
        const res = await setHireDateAction(r.member.id, dates[r.member.id], reason.trim());
        if (!res.ok) errs[r.member.id] = res.error ?? "저장하지 못했어요.";
      }
      setErrors(errs);
      if (Object.keys(errs).length === 0) {
        onClose();
        router.refresh();
      } else {
        setError("일부 직원은 저장하지 못했어요. 표시된 줄을 확인해 주세요.");
        router.refresh();
      }
    });
  const input = "h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="hire-batch-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl" data-hire-batch data-unsaved-ignore>
        <div className="flex items-center">
          <h2 id="hire-batch-title" className="text-lg font-bold">
            입사일 한 번에 넣기
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-[13px] text-zinc-600">아는 직원만 넣어도 돼요. 빈 칸은 그대로 두고 나중에 넣을 수 있어요.</p>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.member.id} className="flex flex-col gap-1">
              <label className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[15px] font-semibold">{r.member.name}</span>
                <input type="date" max={today} value={dates[r.member.id] ?? ""} onChange={(e) => setDates((d) => ({ ...d, [r.member.id]: e.target.value }))} className={`${input} min-w-0 flex-1`} aria-label={`${r.member.name} 입사일`} data-hire-date={r.member.name} />
              </label>
              {errors[r.member.id] && <span className="pl-27 text-[13px] font-semibold text-red-700">{errors[r.member.id]}</span>}
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          사유
          <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={`${input} font-normal`} />
          <span className="text-[13px] font-normal text-zinc-600">근태 정책의 변경 이력에 직원별로 함께 남아요.</span>
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <button type="button" onClick={save} disabled={busy || filled.length === 0} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50" data-hire-batch-save>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {filled.length > 0 ? `${filled.length}명 저장` : "저장"}
        </button>
      </section>
    </div>
  );
}
