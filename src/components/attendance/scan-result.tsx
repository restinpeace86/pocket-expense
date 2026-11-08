"use client";

import { Check, Info, Loader2, LogOut, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { punchAction, type PunchResult } from "@/app/attend/actions";
import { kstDate } from "@/lib/attendance/request";
import { kstTime, stayLabel } from "@/lib/attendance/rules";

// QR 출퇴근 결과 화면(spec/features/attendance.md §3-3·§3-5): 출근 / 퇴근 확인 / 퇴근 / 이미 퇴근 / 실패
const ERRORS: Record<string, { title: string; body: string; retry: boolean }> = {
  EXPIRED: { title: "QR이 바뀌었어요", body: "QR은 30초마다 바뀌어요. 출근 단말 화면의 QR을 다시 찍어 주세요.", retry: true },
  INVALID: { title: "QR을 읽지 못했어요", body: "출근 단말 화면의 QR을 다시 찍어 주세요.", retry: true },
  OTHER_COMPANY: { title: "이 QR로는 출퇴근을 남길 수 없어요", body: "우리 회사 출근 단말의 QR인지 확인해 주세요. 해제된 단말일 수도 있어요.", retry: true },
  DISABLED: { title: "회사에서 근태를 쓰지 않아요", body: "근태가 꺼져 있어요. 관리자에게 문의해 주세요.", retry: false },
  CLOSED: { title: "지금은 출퇴근을 찍을 수 없어요", body: "출퇴근 가능 시간은 06:00 ~ 24:00이에요.", retry: false },
  LOGIN: { title: "로그인이 필요해요", body: "다시 로그인한 뒤 QR을 찍어 주세요.", retry: false },
  FAILED: { title: "기록하지 못했어요", body: "잠시 뒤 다시 찍어 주세요.", retry: true },
};

export function ScanResult({ token, home, camera }: { token: string; home: string; camera: string }) {
  const [result, setResult] = useState<PunchResult | null>(null);
  const [busy, start] = useTransition();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start(async () => setResult(await punchAction(token, false).catch(() => ({ kind: "error", code: "FAILED" }) as PunchResult)));
  }, [token]);
  const confirmOut = () => start(async () => setResult(await punchAction(token, true).catch(() => ({ kind: "error", code: "FAILED" }) as PunchResult)));

  const button = "flex h-13 w-full items-center justify-center rounded-xl text-base font-semibold";
  const primary = `${button} bg-brand-600 text-white hover:bg-brand-700`;
  const secondary = `${button} border border-zinc-300 text-zinc-800 hover:bg-zinc-50`;
  const day = (holiday: boolean) => (holiday ? <span className="mt-6 rounded-md bg-red-50 px-2.5 py-1 text-[13px] font-semibold text-red-700">휴일</span> : null);

  if (!result) {
    return (
      <main className="mx-auto w-full flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6" aria-busy>
        <Loader2 className="size-10 animate-spin text-brand-600" aria-hidden />
        <p className="text-zinc-600">기록하는 중…</p>
      </main>
    );
  }

  if (result.kind === "confirm_out") {
    return (
      <main className="relative mx-auto w-full min-h-dvh max-w-md bg-zinc-700/60">
        <section role="dialog" aria-modal="true" aria-labelledby="out-title" className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 rounded-t-3xl bg-white px-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] pt-6">
          <h1 id="out-title" className="text-[22px] font-bold">
            퇴근할까요?
          </h1>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            출근 {kstTime(result.inAt)} → 지금 {kstTime(result.now)}
            <br />
            <b>오늘 {stayLabel(result.inAt, result.now)}</b>
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">퇴근은 하루 한 번만 찍을 수 있어요. 더 일하게 되면 나중에 정정 신청으로 고쳐요.</p>
          <div className="mt-5 flex gap-2.5">
            <Link href={home} className={`${secondary} flex-1`}>
              취소
            </Link>
            <button type="button" onClick={confirmOut} disabled={busy} className={`${primary} flex-[2] disabled:opacity-80`}>
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "퇴근"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  let icon, title, body, extra, actions;
  if (result.kind === "in") {
    icon = <Check className="size-13 text-green-700" strokeWidth={2.6} aria-hidden />;
    title = `출근 ${kstTime(result.inAt)}`;
    body = "퇴근할 때 같은 QR을 한 번 더 찍으세요.";
    extra = day(result.holiday);
    actions = <Link href={home} className={primary}>홈으로</Link>;
  } else if (result.kind === "out") {
    icon = <LogOut className="size-12 text-brand-700" aria-hidden />;
    title = `퇴근 ${kstTime(result.outAt)}`;
    body = (
      <>
        출근 {kstTime(result.inAt)} · 오늘 <b className="text-zinc-900">{stayLabel(result.inAt, result.outAt)}</b> 머물렀어요
      </>
    );
    extra = (
      <>
        {day(result.holiday)}
        <p className="mt-5 w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-sm leading-relaxed text-zinc-700">
          {result.holiday ? "휴일 기록은 남았어요. 휴일 근무 상신 → 관리자 승인이 되어야 근무한 날로 인정돼요. 나중에 [근태]에서 그날을 눌러 올려도 돼요." : "퇴근 시각이 다르면 [근태]에서 정정 신청으로 고칠 수 있어요."}
        </p>
      </>
    );
    actions = result.holiday ? (
      <>
        <Link href={`${home}/attendance/request?date=${kstDate(result.inAt)}&kind=holiday`} className={primary}>
          휴일 근무 상신
        </Link>
        <Link href={home} className={secondary}>
          나중에 · 홈으로
        </Link>
      </>
    ) : (
      <Link href={home} className={primary}>홈으로</Link>
    );
  } else if (result.kind === "already") {
    icon = <Info className="size-12 text-zinc-600" aria-hidden />;
    title = "오늘은 이미 퇴근했어요";
    body = (
      <>
        출근 {kstTime(result.inAt)} · 퇴근 {kstTime(result.outAt)}
        <br />
        이번에 찍은 건 기록하지 않았어요.
      </>
    );
    extra = <p className="mt-5 w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-sm leading-relaxed text-zinc-700">실수로 일찍 찍었거나 퇴근 후 더 일했다면 정정 신청을 올려 주세요. 관리자가 승인하면 고쳐져요.</p>;
    actions = (
      <>
        <Link href={`${home}/attendance/request?date=${kstDate(result.inAt)}&kind=${result.holiday ? "holiday" : "correction"}`} className={primary}>
          {result.holiday ? "휴일 근무 상신" : "정정 신청"}
        </Link>
        <Link href={home} className={secondary}>
          홈으로
        </Link>
      </>
    );
  } else {
    const e = ERRORS[result.code] ?? ERRORS.FAILED;
    icon = <RotateCw className="size-12 text-orange-700" aria-hidden />;
    title = e.title;
    body = e.body;
    actions = (
      <>
        {e.retry && <Link href={camera} className={primary}>다시 찍기</Link>}
        <Link href={home} className={e.retry ? secondary : primary}>
          홈으로
        </Link>
      </>
    );
  }
  const tone = result.kind === "in" ? "bg-green-100" : result.kind === "out" ? "bg-brand-50" : result.kind === "already" ? "bg-zinc-100" : "bg-orange-100";
  return (
    <main className="mx-auto w-full flex min-h-dvh max-w-md flex-col items-center px-6 pt-[22vh] text-center">
      <div className={`flex size-24 items-center justify-center rounded-full ${tone}`}>{icon}</div>
      <h1 className="mt-7 text-[26px] font-bold" aria-live="polite">
        {title}
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-600">{body}</p>
      {extra}
      <div className="mt-auto flex w-full flex-col gap-2.5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8">{actions}</div>
    </main>
  );
}
