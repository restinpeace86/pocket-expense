"use client";

import { ClipboardCheck, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { laterSetupAction, startSetupAction } from "@/app/workspace/[id]/admin/setup/actions";
import { BRAND } from "@/lib/brand";
import { minutesLabel, progress, resumeStep, setupSteps, type SetupState } from "@/lib/admin/setup-wizard";

// 최초 1회 설정(D-300) 관리자 홈:
//  · 새로 가입한 회사가 처음 들어오면 시작 안내 창(한 번만) — 걸리는 시간·단계 수·해야 하는 이유, [지금 시작]·[나중에 할게요]
//  · 안내에 답한 뒤 다 끝내기 전까지 '처음 설정' 자리에 진행 카드 — [이어서 하기]·[처음부터 보기]
export function SetupIntroDialog({ companyId, attendanceOn }: { companyId: string; attendanceOn: boolean }) {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  if (!open) return null;
  const steps = setupSteps(attendanceOn);
  const p = progress({ statuses: {} }, attendanceOn);
  const groups = [...new Map(steps.map((s) => [s.group, s.groupLabel])).entries()].map(([g, label]) => ({ g, label, n: steps.filter((s) => s.group === g).length }));
  const withAtt = attendanceOn ? null : progress({ statuses: {} }, true).minutesTotal;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="setup-intro-title" data-setup-intro>
      <div className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h2 id="setup-intro-title" className="flex items-center gap-2 text-lg font-bold">
          <Wand2 className="size-5 text-brand-600" />
          최초 1회 설정을 해 둘까요?
        </h2>
        <p className="break-keep text-sm leading-relaxed text-zinc-700">
          회사에 맞게 한 번만 정해 두면 직원이 경비를 올릴 때 한도·법인카드·결재라인이 자동으로 맞춰져요. 지금 안 해도 기본값({BRAND.name} 추천 설정)으로 바로 쓸 수 있어요.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm tabular-nums">
          <dt className="text-zinc-500">걸리는 시간</dt>
          <dd className="font-semibold" data-setup-minutes>
            {minutesLabel(p.minutesTotal)}
            {withAtt ? <span className="font-normal text-zinc-500"> (근태까지 쓰면 {minutesLabel(withAtt)})</span> : null}
          </dd>
          <dt className="text-zinc-500">순서</dt>
          <dd className="font-semibold">
            {groups.length}개 메뉴 · {steps.length}단계
          </dd>
          <dt className="text-zinc-500">중간에 멈추면</dt>
          <dd className="font-semibold">한 곳까지 기록돼요, 나중에 이어서</dd>
        </dl>
        <ul className="flex flex-wrap gap-1">
          {groups.map((x) => (
            <li key={x.g} className="rounded-md bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
              {x.label} {x.n}
            </li>
          ))}
        </ul>
        <p className="break-keep text-xs text-zinc-500">각 단계는 [건너뛰기]해도 돼요. 건너뛴 단계는 마지막에 모아서 보여 드려요. 나중에 하려면 홈의 진행 카드나 설정 화면 위 [설정 마법사]를 누르세요.</p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" disabled={pending} onClick={() => start(() => startSetupAction(companyId, "first"))} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-setup-start>
            지금 시작 ({minutesLabel(p.minutesTotal)})
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              start(() => laterSetupAction());
            }}
            className="min-h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
            data-setup-later
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}

export function SetupHomeCard({ companyId, basePath, state, attendanceOn }: { companyId: string; basePath: string; state: SetupState; attendanceOn: boolean }) {
  const [pending, start] = useTransition();
  const p = progress(state, attendanceOn);
  const next = resumeStep(state, attendanceOn);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-white p-5 shadow-sm" aria-labelledby="setup-card-title" data-setup-card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-card-title" className="flex items-center gap-2 font-semibold">
          <ClipboardCheck className="size-5 text-brand-600" />
          최초 1회 설정
        </h2>
        <span className="text-sm tabular-nums text-zinc-600">
          {p.total}단계 중 {p.handled}단계 끝 · <b className="text-zinc-900">{p.percent}%</b>
          {!p.allHandled && ` · 남은 시간 ${minutesLabel(p.minutesLeft)}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="최초 1회 설정 진행률">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.percent}%` }} />
      </div>
      {next && (
        <p className="text-sm text-zinc-600">
          다음 단계: {next.groupLabel} › {next.label}
          {state.statuses[next.key] === "skipped" ? " (건너뛴 단계)" : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => start(() => startSetupAction(companyId, "resume"))} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-setup-resume>
          {p.handled ? "이어서 하기" : "지금 시작"}
        </button>
        <Link href={`${basePath}/setup`} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50">
          단계 전체 보기
        </Link>
      </div>
    </section>
  );
}
