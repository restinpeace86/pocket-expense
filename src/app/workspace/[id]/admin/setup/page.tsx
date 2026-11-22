import { Check, ChevronRight, Circle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SectionHeading } from "@/components/ui/help";
import { attendanceEnabled } from "@/lib/attendance/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";
import { minutesLabel, progress, setupSteps } from "@/lib/admin/setup-wizard";
import { getSetupState } from "@/lib/admin/setup-wizard-server";
import { startSetupAction } from "./actions";

export const metadata = { title: `최초 1회 설정 · ${BRAND.name}` };

// 최초 1회 설정 한눈에 보기 + 다 끝난 뒤 요약(D-300). 단계마다 완료·건너뜀·아직 표시, [이어서 하기]·[처음부터 보기]
export default function SetupPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/setup">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: { params: PageProps<"/workspace/[id]/admin/setup">["params"]; searchParams: PageProps<"/workspace/[id]/admin/setup">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireWorkspace(id, { admin: true });
  const [state, att] = await Promise.all([getSetupState(), attendanceEnabled()]);
  const steps = setupSteps(att);
  const p = progress(state, att);
  const base = `/workspace/${id}/admin`;
  const justDone = sp.done === "1" && p.allHandled;
  const groups = [...new Map(steps.map((s) => [s.group, s.groupLabel])).entries()];
  return (
    <>
      <SectionHeading
        as="h1"
        title={justDone ? "최초 1회 설정을 마쳤어요 🎉" : "최초 1회 설정"}
        summary={
          justDone
            ? "건너뛴 단계는 언제든 설정에서 바꿀 수 있어요. 설정 화면 위 [설정 마법사]로 다시 한 번 훑어볼 수도 있어요."
            : `회사에 맞게 한 번만 정해 두면 직원이 경비를 올릴 때 한도·법인카드·결재라인이 자동으로 맞춰져요. 전체 ${steps.length}단계, ${minutesLabel(p.minutesTotal)} 걸려요.`
        }
      />
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" data-setup-summary>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
          <span className="text-zinc-700">
            {p.total}단계 중 <b className="text-zinc-900">{p.done}단계 완료</b>
            {p.skipped.length > 0 && ` · ${p.skipped.length}단계 건너뜀`}
          </span>
          <span className="text-zinc-600">
            <b className="text-zinc-900">{p.percent}%</b>
            {!p.allHandled && ` · 남은 시간 ${minutesLabel(p.minutesLeft)}`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="최초 1회 설정 진행률">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.percent}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!p.allHandled || p.skipped.length > 0 ? (
            <form action={startSetupAction.bind(null, id, "resume")}>
              <button className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" data-setup-resume>
                {p.allHandled ? "건너뛴 단계 지금 하기" : p.handled ? "이어서 하기" : "지금 시작"}
              </button>
            </form>
          ) : null}
          <form action={startSetupAction.bind(null, id, "first")}>
            <button className="min-h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50">처음부터 보기</button>
          </form>
          <Link href={base} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-zinc-600 hover:text-zinc-900">
            관리자 홈으로
          </Link>
        </div>
      </section>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {groups.map(([g, label]) => (
          <section key={g} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">{label}</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {steps
                .filter((s) => s.group === g)
                .map((s) => {
                  const st = state.statuses[s.key];
                  return (
                    <li key={s.key}>
                      <Link href={`${base}${s.href}`} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-zinc-50" data-setup-row={s.key}>
                        {st === "done" ? <Check className="size-4 shrink-0 text-green-600" /> : <Circle className="size-4 shrink-0 text-zinc-300" />}
                        <span className="min-w-0 flex-1">{s.label}</span>
                        {st === "skipped" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">건너뜀</span>}
                        {st === "done" && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">완료</span>}
                        {!st && <span className="text-xs text-zinc-400">{minutesLabel(s.minutes)}</span>}
                        <ChevronRight className="size-4 shrink-0 text-zinc-400" />
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
