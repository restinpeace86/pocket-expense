"use client";

import { Check, Wand2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { hasUnsaved } from "@/lib/ui/unsaved-store";
import { findSettingsTab } from "@/lib/admin/settings-groups";
import { groupStatus, minutesLabel, progress, setupSteps, stepForPath, type SetupState } from "@/lib/admin/setup-wizard";
import { markSetupStepAction, pauseSetupAction, startSetupAction } from "@/app/workspace/[id]/admin/setup/actions";

export type SetupBarData = { state: SetupState; attendanceOn: boolean; on: boolean };

// 최초 1회 설정 진행 띠(D-300 · U-1 A안). 설정 화면 맨 위:
//  · 진행 중 + 지금 화면이 단계 → 전체 N단계 중 M단계 · % · 남은 시간 / 메뉴 안 단계 / 이유 한 줄 / [건너뛰기] [완료하고 다음]
//  · 진행 중 + 단계 아닌 설정 화면 → 한 줄 [이어서 하기]
//  · 멈춘 상태 → 오른쪽 작은 [설정 마법사 %] 버튼
// 저장 안 한 입력이 있으면 넘어가기 전에 확인 — 목록은 UnsavedGuard(U-2)와 같은 것(unsaved-store)
export function SetupWizardBar({ base, companyId, data }: { base: string; companyId: string; data: SetupBarData }) {
  const pathname = usePathname();
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const onSettings = !!findSettingsTab(rest);
  const step = stepForPath(rest, data.attendanceOn);
  // 화면이 바뀌면 확인 창은 저절로 닫힘(주소별로 기억)
  const [confirmAt, setConfirmAt] = useState<{ path: string; status: "done" | "skipped" } | null>(null);
  const confirm = confirmAt?.path === pathname ? confirmAt.status : null;
  const setConfirm = (status: "done" | "skipped" | null) => setConfirmAt(status ? { path: pathname, status } : null);
  const [pending, start] = useTransition();
  // 설정 화면 + 설정 밖 단계(직원 초대 = 멤버 관리)에서만
  if (!onSettings && !step) return null;

  const p = progress(data.state, data.attendanceOn);
  const go = (mode: "resume" | "first") => start(() => startSetupAction(companyId, mode));

  if (!data.on) {
    if (!onSettings) return null; // 멤버 관리 화면엔 [설정 마법사] 버튼을 안 띄움
    return (
      <div className="-mb-2 flex justify-end">
        <button type="button" onClick={() => go(data.state.finished ? "first" : "resume")} disabled={pending} data-setup-launch className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60">
          <Wand2 className="size-3.5" />
          설정 마법사{data.state.finished || p.allHandled ? " · 다시 훑어보기" : ` ${p.percent}%`}
        </button>
      </div>
    );
  }

  const steps = setupSteps(data.attendanceOn);
  const idx = step ? steps.findIndex((s) => s.key === step.key) : -1;
  const groupSteps = step ? steps.filter((s) => s.group === step.group) : [];
  const groups = [...new Map(steps.map((s) => [s.group, s.groupLabel])).entries()];
  const last = !!step && p.total - p.handled <= 1 && !data.state.statuses[step.key];
  const mark = (status: "done" | "skipped") => {
    if (!step) return;
    if (hasUnsaved() && confirm !== status) return setConfirm(status);
    start(() => markSetupStepAction(companyId, step.key, status));
  };

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-brand-200 bg-white p-4 shadow-sm" aria-label="최초 1회 설정 진행" data-setup-bar={step?.key ?? "off-step"}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm tabular-nums">
        <span className="text-zinc-700">
          <b className="text-zinc-900">최초 1회 설정</b>
          {step ? (
            <>
              {" "}· 전체 {p.total}단계 중 <b className="text-zinc-900" data-setup-index>{idx + 1}단계</b>
            </>
          ) : (
            ` · ${p.total}단계 중 ${p.handled}단계 끝`
          )}
        </span>
        <span className="text-zinc-600">
          <b className="text-zinc-900" data-setup-percent>{p.percent}%</b> · 남은 시간 {minutesLabel(p.minutesLeft)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="최초 1회 설정 진행률">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${p.percent}%` }} />
      </div>
      <ul className="hidden flex-wrap gap-1 md:flex" aria-label="메뉴별 진행">
        {groups.map(([g, label]) => {
          const gs = groupStatus(g, data.state.statuses, data.attendanceOn);
          const cur = step?.group === g;
          return (
            <li key={g} className={`rounded-md px-2 py-0.5 text-xs ${cur ? "bg-brand-50 font-semibold text-brand-700" : gs?.complete ? "text-green-700" : "bg-zinc-50 text-zinc-500"}`}>
              {gs?.complete && !cur ? "✓ " : ""}
              {label}
            </li>
          );
        })}
      </ul>
      {step ? (
        <>
          {groupSteps.length > 1 && (
            <ol className="flex flex-wrap items-center gap-1.5 text-xs" aria-label={`${step.groupLabel} 단계`}>
              {groupSteps.map((s, i) => {
                const st = data.state.statuses[s.key];
                const cur = s.key === step.key;
                return (
                  <li key={s.key} className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 ${cur ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : st === "done" ? "border-green-200 bg-green-50 text-green-700" : st === "skipped" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-zinc-200 text-zinc-500"}`}>
                    {st === "done" && !cur ? <Check className="size-3" /> : <span>{i + 1}</span>}
                    {s.label}
                    {st === "skipped" && !cur && <span className="sr-only">(건너뜀)</span>}
                  </li>
                );
              })}
              <li className="text-zinc-500">
                {step.groupLabel} {groupSteps.findIndex((s) => s.key === step.key) + 1}/{groupSteps.length}
              </li>
            </ol>
          )}
          <p className="break-keep rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900" data-setup-why>
            {step.why}
          </p>
          {confirm && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="break-keep">이 화면에 저장하지 않은 내용이 있어요. 아래 [저장]을 먼저 누르거나, 저장하지 않고 넘어갈 수 있어요.</span>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirm(null)} className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 font-medium">돌아가서 저장</button>
                <button type="button" onClick={() => mark(confirm)} disabled={pending} className="min-h-9 rounded-lg px-3 font-medium underline" data-setup-discard>
                  저장하지 않고 넘어가기
                </button>
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            <button type="button" onClick={() => start(() => pauseSetupAction())} disabled={pending} className="min-h-10 px-1 text-sm text-zinc-500 hover:text-zinc-800" data-setup-pause>
              잠시 멈추기<span className="hidden sm:inline"> (나중에 이어서)</span>
            </button>
            <span className="flex gap-2">
              <button type="button" onClick={() => mark("skipped")} disabled={pending} className="min-h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60" data-setup-skip>
                건너뛰기
              </button>
              <button type="button" onClick={() => mark("done")} disabled={pending} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-setup-done>
                {last ? "설정 완료" : "완료하고 다음 →"}
              </button>
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-zinc-600">이 화면은 최초 1회 설정 단계가 아니에요.</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => start(() => pauseSetupAction())} disabled={pending} className="min-h-10 px-2 text-sm text-zinc-500" data-setup-pause>
              잠시 멈추기
            </button>
            <button type="button" onClick={() => go("resume")} disabled={pending} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">
              이어서 하기
            </button>
          </span>
        </div>
      )}
    </section>
  );
}

