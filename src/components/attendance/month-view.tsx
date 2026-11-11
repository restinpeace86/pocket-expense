"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useUrlSheet } from "@/components/ui/use-url-sheet";
import { cancelAttendanceRequest } from "@/app/workspace/[id]/employee/attendance/actions";
import { minutesLabel, monthLabel, type MonthRow, type MonthSummary, type RowBadge } from "@/lib/attendance/month";
import { changeLines } from "@/lib/attendance/request";
import { kstTime } from "@/lib/attendance/rules";
import { RequestPanel } from "./request-form";

// 월 근태 현황(spec/features/attendance.md §5 D-237, §6 D-239): 요약 + 날짜 목록(최근 위) + 날짜 누르면 그날 상세(정정 신청·휴일 근무 상신)
// D-257: 그날 상세·신청 칸은 한 화면 안의 창. 주소 ?date=…&kind=…로 열어 휴대폰 [뒤로]가 창만 닫는다
const BADGE: Record<RowBadge, { text: string; cls: string } | undefined> = {
  plain: undefined,
  auto: { text: "자동 퇴근", cls: "bg-orange-100 text-orange-800" },
  holiday: { text: "휴일 · 상신 전", cls: "bg-red-50 text-red-700" },
  none: { text: "기록 없음", cls: "bg-zinc-100 text-zinc-700" },
  open: { text: "퇴근 전", cls: "bg-green-100 text-green-800" },
  noout: { text: "퇴근 없음", cls: "bg-orange-100 text-orange-800" },
  before: { text: "출근 전", cls: "bg-zinc-100 text-zinc-700" },
  pending: { text: "정정 대기", cls: "bg-amber-100 text-amber-900" },
  holidayPending: { text: "휴일 · 승인 대기", cls: "bg-amber-100 text-amber-900" },
  holidayApproved: { text: "휴일 근무 인정", cls: "bg-green-100 text-green-800" },
  holidayRejected: { text: "휴일 · 반려", cls: "bg-zinc-200 text-zinc-800" },
  rejected: { text: "반려", cls: "bg-zinc-200 text-zinc-800" },
  corrected: { text: "정정됨", cls: "bg-indigo-100 text-indigo-800" },
  leave: { text: "휴가", cls: "bg-teal-100 text-teal-800" },
};
const tone = { weekday: "text-zinc-900", sat: "text-blue-700", red: "text-red-700" } as const;
const FLASH: Record<string, string> = {
  pending: "신청을 보냈어요. 관리자가 처리하면 [알림]방으로 알려 드려요.",
  self: "대표 본인 신청이라 바로 승인돼 기록에 반영됐어요.",
  canceled: "신청을 취소했어요.",
};

function subLine(r: MonthRow): string | null {
  if (r.leave && r.kind !== "leave") return r.leave.text;
  if (r.pending) return r.pending.kind === "holiday" ? "휴일 근무 상신 · 승인 대기" : `${changeLines(r.pending).map((l) => `${l.label} ${l.to}`).join(" · ")}(으)로 신청`;
  if (r.lastRejected) return "반려 사유 보기";
  if (r.canHoliday) return "눌러서 휴일 근무 상신";
  const last = r.changes[r.changes.length - 1];
  if (last && r.record) {
    const l = changeLines(last).filter((x) => x.label !== "시각");
    return l.length ? `원래 ${l.map((x) => `${x.label} ${x.from}`).join(" · ")}` : null;
  }
  return null;
}

export function MonthView({
  base,
  month,
  prev,
  next,
  rows,
  summary,
  monthEnd,
  flash,
  readOnly = false,
  title = "출퇴근 기록",
  backHref,
  backLabel = "홈으로",
  monthPrefix,
  request,
}: {
  base: string;
  month: string;
  prev: string;
  next: string | null;
  rows: MonthRow[];
  summary: MonthSummary;
  monthEnd: string | null;
  flash: string | null;
  // 관리자가 직원 월 근태를 볼 때(D-242): 신청·취소 버튼 없이 보기만
  readOnly?: boolean;
  title?: string;
  backHref?: string;
  backLabel?: string;
  monthPrefix?: string; // 달 이동 주소 앞부분(서버에서 넘김 — 함수는 못 넘김)
  // 직원 화면: 창 안 신청 칸에 쓸 오늘 날짜·정규 출퇴근 시각(관리자 보기는 없음)
  request?: { today: string; defaults: { in: string; out: string } };
}) {
  const mHref = (m: string) => `${monthPrefix ?? `${base}/attendance?month=`}${m}`;
  // 날짜는 주소에서(취소 뒤 목록이 새로 오면 열린 날도 새 값)
  const sheet = useUrlSheet();
  const openDate = sheet.get("date");
  const kindParam = sheet.get("kind");
  const open = openDate ? (rows.find((r) => r.date === openDate) ?? null) : null;
  const closeAll = () => sheet.close(["date", "kind"]);
  useEffect(() => {
    if (!openDate) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && sheet.close(["date", "kind"]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // sheet은 매번 새 객체지만 하는 일은 같다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDate]);
  const monthHref = (date: string, done: string) => `${base}/attendance?month=${date.slice(0, 7)}&done=${done}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-3xl md:px-6 md:pt-6">
      <div className="flex flex-wrap items-center gap-1">
        <Link href={backHref ?? base} aria-label={backLabel} className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="min-w-0 truncate text-xl font-bold md:text-2xl">{title}</h1>
        <div className="ml-auto flex items-center">
          <Link href={mHref(prev)} aria-label="이전 달" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
            <ChevronLeft className="size-5" />
          </Link>
          <b className="min-w-28 text-center text-[17px]">{monthLabel(month)}</b>
          {next ? (
            <Link href={mHref(next)} aria-label="다음 달" className="flex size-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span aria-hidden className="flex size-11 items-center justify-center text-zinc-300">
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      </div>

      {flash && FLASH[flash] && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 px-3.5 py-3 text-sm text-green-900" data-flash={flash}>
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {FLASH[flash]}
        </p>
      )}
      {monthEnd && !readOnly && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-950" data-month-end>
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
          <span>
            이번 달 기록은 <b>말일({monthEnd})까지만</b> 정정 신청할 수 있어요. 빠진 출퇴근이나 자동 퇴근이 없는지 지금 확인해 주세요.
          </span>
        </p>
      )}

      <section aria-label="이번 달 요약" className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 md:grid-cols-4 md:px-5">
        <div>
          <p className="text-xs text-zinc-600">출근한 날</p>
          <b className="text-lg">{summary.worked}일</b>
          {summary.holidayWorked > 0 && <span className="ml-1 text-xs text-red-700">휴일 근무 {summary.holidayWorked}일 인정</span>}
        </div>
        <div>
          <p className="text-xs text-zinc-600">머문 시간 합계</p>
          <b className="text-lg">{minutesLabel(summary.minutes)}</b>
        </div>
        <div>
          <p className="text-xs text-zinc-600">자동 퇴근</p>
          <b className={`text-lg ${summary.auto ? "text-orange-700" : ""}`}>{summary.auto}번</b>
        </div>
        <div>
          <p className="text-xs text-zinc-600">기록 없는 근무일</p>
          <b className="text-lg text-zinc-600">{summary.missing}일</b>
          {summary.leaveDays > 0 && <span className="ml-1 text-xs text-teal-800">휴가 {summary.leaveDays}일은 빼고 셌어요</span>}
        </div>
      </section>
      {(summary.pending > 0 || summary.rejected > 0 || summary.holidayWaiting > 0) && (
        <p className="rounded-xl bg-indigo-50 px-3.5 py-3 text-sm text-indigo-900" data-my-requests>
          <b>내 신청</b> 승인 대기 {summary.pending}건 · 반려 {summary.rejected}건
          {summary.holidayWaiting > 0 && <span className="block text-xs text-indigo-800">휴일 출근 {summary.holidayWaiting}일은 상신 → 승인돼야 출근한 날로 세요.</span>}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">이 달에는 출퇴근 기록이 없어요.</p>
      ) : (
        <ul aria-label="날짜별 출퇴근" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {rows.map((r) => {
            const b = BADGE[r.badge];
            const sub = subLine(r);
            return (
              <li key={r.date} className="border-b border-zinc-100 last:border-b-0">
                <button type="button" onClick={() => sheet.open({ date: r.date, kind: null })} data-day={r.date} data-kind={r.kind} data-badge={r.badge} className="flex min-h-14 w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-zinc-50">
                  <span className={`w-[4.25rem] shrink-0 text-sm font-semibold ${tone[r.dayTone]}`}>{r.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${r.inTime ? "text-zinc-900" : "text-zinc-500"}`}>
                      {r.inTime ? `${r.inTime} – ${r.outTime ?? "퇴근 전"}` : r.kind === "leave" ? (r.leave?.text ?? "휴가") : r.kind === "before" ? "아직 출근 전" : "출퇴근 기록 없음"}
                    </span>
                    {r.stay && <span className="block text-xs text-zinc-600">{r.stay}</span>}
                    {sub && <span className="block truncate text-xs text-indigo-700">{sub}</span>}
                  </span>
                  {b && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>}
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-zinc-600">기록 없는 휴일은 목록에 나오지 않아요.{readOnly ? " 관리자 보기라 신청·취소는 할 수 없어요." : " 휴일 근무는 QR로 찍은 날만 상신할 수 있어요. 정정 신청은 이번 달 기록만 할 수 있어요."}</p>

      {open && (
        <DaySheet
          row={open}
          readOnly={readOnly}
          kind={!readOnly && request && (kindParam === "holiday" ? open.canHoliday : kindParam === "correction" ? open.canCorrect : false) ? (kindParam as "correction" | "holiday") : null}
          request={request}
          onClose={closeAll}
          onForm={(k) => sheet.open({ kind: k })}
          onBack={() => sheet.back({ kind: null })}
          onFinish={(done) => sheet.finish(monthHref(open.date, done))}
        />
      )}
    </main>
  );
}

function DaySheet({
  row,
  readOnly,
  kind,
  request,
  onClose,
  onForm,
  onBack,
  onFinish,
}: {
  row: MonthRow;
  readOnly: boolean;
  kind: "correction" | "holiday" | null;
  request?: { today: string; defaults: { in: string; out: string } };
  onClose: () => void;
  onForm: (k: "correction" | "holiday") => void;
  onBack: () => void;
  onFinish: (done: string) => void;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const r = row.record;
  const b = BADGE[row.badge];
  const cancel = (id: string) =>
    start(async () => {
      setError(null);
      const res = await cancelAttendanceRequest(id);
      if (!res.ok) return setError(res.error ?? "취소하지 못했어요.");
      onFinish("canceled");
    });
  const outVia = (m: string | null | undefined) => (m === "auto" ? "자동" : m === "correction" ? "정정" : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 md:rounded-3xl md:pb-6"
        data-day-sheet={row.date}
      >
        {kind && request ? (
          <RequestPanel key={kind} kind={kind} row={row} today={request.today} defaults={request.defaults} onBack={onBack} onDone={(self) => onFinish(self ? "self" : "pending")} />
        ) : (
        <>
        <div className="flex items-center gap-2">
          <h2 id="day-title" className="text-xl font-bold">
            {row.label}
          </h2>
          {b && <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.text}</span>}
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        {r ? (
          <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-y-3 text-[15px]">
            <dt className="text-zinc-600">출근</dt>
            <dd>
              <b>{row.inTime}</b>
              {(r.in_method === "correction" || r.in_terminal) && <span className="text-zinc-600"> · {r.in_method === "correction" ? "정정" : r.in_terminal}</span>}
            </dd>
            <dt className="text-zinc-600">퇴근</dt>
            <dd>
              {row.outTime ? (
                <>
                  <b>{row.outTime}</b>
                  {(outVia(r.out_method) ?? r.out_terminal) && <span className="text-zinc-600"> · {outVia(r.out_method) ?? r.out_terminal}</span>}
                  {r.out_method === "auto" && <span className="block text-[13px] text-orange-800">자정까지 안 찍어 정규 퇴근 시각({r.sched_end})으로 자동 기록됐어요</span>}
                </>
              ) : (
                <span className="text-zinc-600">{row.kind === "open" ? "아직 퇴근 전이에요" : "퇴근 기록이 없어요"}</span>
              )}
            </dd>
            <dt className="text-zinc-600">머문 시간</dt>
            <dd>
              <b>{row.stay ?? "-"}</b>
            </dd>
            <dt className="text-zinc-600">구분</dt>
            <dd>{r.holiday ? `휴일${row.holidayName ? ` (${row.holidayName})` : ""}${r.holiday_approved ? " · 근무 인정" : " · 승인 전"}` : "근무일"}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-[15px] text-zinc-700">{row.kind === "leave" ? `승인된 휴가예요 (${row.leave?.name}).` : row.kind === "before" ? "오늘은 아직 출근 기록이 없어요." : "이 근무일에는 출퇴근 기록이 없어요."}</p>
        )}

        {row.changes.length > 0 && (
          <section aria-label="바뀐 기록" className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 text-[13px] leading-relaxed text-indigo-950">
            <b>바뀐 기록</b>
            {row.changes.map((c) => (
              <div key={c.id} className="mt-1.5 border-t border-indigo-100 pt-1.5 first:border-t-0 first:pt-0" data-change>
                {c.kind === "holiday" && <span className="block font-semibold">휴일 근무 인정</span>}
                {changeLines(c)
                  .filter((l) => l.label !== "시각")
                  .map((l) => (
                    <span key={l.label} className="block">
                      {l.label} <s className="text-indigo-700/70">{l.from}</s> → {l.to}
                    </span>
                  ))}
                <span className="block text-indigo-800">
                  신청 {kstTime(c.created_at)} · {c.kind === "holiday" ? "한 일" : "사유"} &quot;{c.reason}&quot;
                </span>
                <span className="block text-indigo-800">{c.self_approved ? "대표 본인 승인" : `승인 ${c.decided_at ? kstTime(c.decided_at) : ""} · ${c.decided_by_name ?? ""}`}</span>
              </div>
            ))}
          </section>
        )}

        {row.pending && (
          <section aria-label="승인 대기 중인 신청" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-950" data-pending>
            <b>{row.pending.kind === "holiday" ? "휴일 근무 상신 · 승인 대기" : "정정 신청 · 승인 대기"}</b>
            {changeLines(row.pending)
              .filter((l) => l.label !== "시각")
              .map((l) => (
                <span key={l.label} className="block">
                  {l.label} {l.from} → <b>{l.to}</b>
                </span>
              ))}
            <span className="block">
              {row.pending.kind === "holiday" ? "한 일" : "사유"}: {row.pending.reason}
            </span>
            {!readOnly && (
              <button type="button" disabled={busy} onClick={() => cancel(row.pending!.id)} className="mt-2 flex h-10 items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-70">
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                신청 취소
              </button>
            )}
          </section>
        )}

        {row.lastRejected && (
          <section aria-label="반려된 신청" className="mt-4 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-800" data-rejected>
            <b>{row.lastRejected.kind === "holiday" ? "휴일 근무 상신이 반려됐어요" : "정정 신청이 반려됐어요"}</b>
            <span className="block">반려 사유: {row.lastRejected.reject_reason}</span>
            <span className="block text-zinc-600">반려 {row.lastRejected.decided_at ? kstTime(row.lastRejected.decided_at) : ""} · {row.lastRejected.decided_by_name}</span>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {readOnly ? null : row.canHoliday ? (
          <>
            <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-900">휴일 출근은 상신 → 관리자 승인이 되어야 근무한 날로 인정돼요. 시각이 다르면 상신할 때 함께 고칠 수 있어요.</p>
            <button type="button" onClick={() => onForm("holiday")} className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700" data-open-request="holiday">
              휴일 근무 상신
            </button>
          </>
        ) : row.canCorrect ? (
          <>
            <p className="mt-4 rounded-xl bg-zinc-100 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-700">실제 시각이 다르면 정정 신청으로 고칠 수 있어요. 관리자가 승인하면 바뀌고, 원래 기록은 남아요.</p>
            <button type="button" onClick={() => onForm("correction")} className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700" data-open-request="correction">
              정정 신청
            </button>
          </>
        ) : (
          !row.pending && (
            <p className="mt-4 rounded-xl bg-zinc-100 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-700">
              {row.pastMonth
                ? "지난 달 기록은 정정할 수 없어요. 정정 신청은 이번 달 기록만 할 수 있어요."
                : r?.holiday && !r.out_at
                  ? "퇴근을 찍은 뒤에 휴일 근무를 상신할 수 있어요."
                  : "이 날짜는 신청할 수 없어요(근태를 켜기 전이거나 가입 전이에요)."}
            </p>
          )
        )}
        </>
        )}
      </section>
    </div>
  );
}
