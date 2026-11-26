import { ArrowRight, Check, ChevronDown, Circle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ClosingHandoffButton } from "@/components/admin/closing-handoff";
import { HometaxFiles } from "@/components/tax-office/hometax-files";
import { SectionHeading } from "@/components/ui/help";
import { closingProgress, closingSteps, type ClosingStepKey } from "@/lib/admin/closing-wizard";
import { getClosingData } from "@/lib/admin/closing-wizard-server";
import { requireWorkspace } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";
import { currentMonthKst } from "@/lib/dates";
import { claimCutoff, mdLabel, monthLabel, taxCloseDue } from "@/lib/expense/deadline";
import { getHolidays } from "@/lib/expense/holidays";
import { MONTH } from "@/lib/tax/closing";
import { deleteHometaxAction, uploadHometaxAction } from "../export/hometax-actions";

export const metadata = { title: `월 마감 도우미 · ${BRAND.name}` };

// 월 마감 도우미(D-315): 지난달 세무 마감을 설정 마법사처럼 단계별로. 단계 상태는 실제 데이터로(따로 저장 안 함), 막지 않음
export default function ClosingPage({ params, searchParams }: PageProps<"/workspace/[id]/admin/closing">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold";

async function Content({ params, searchParams }: { params: PageProps<"/workspace/[id]/admin/closing">["params"]; searchParams: PageProps<"/workspace/[id]/admin/closing">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const membership = await requireWorkspace(id, { admin: true });
  const now = currentMonthKst();
  const month = typeof sp.month === "string" && MONTH.test(sp.month) && sp.month <= now ? sp.month : prevMonth(now);
  const [data, holidays] = await Promise.all([getClosingData(membership.company_id, month), getHolidays()]);
  if (!data) notFound();
  const { input } = data;
  const steps = closingSteps(input);
  const p = closingProgress(steps);
  const m = monthLabel(month);
  const base = `/workspace/${id}/admin`;
  const due = taxCloseDue(month, holidays);
  const cutoff = claimCutoff(month, holidays);

  const body: Record<ClosingStepKey, ReactNode> = {
    approvals: (
      <>
        <p className="break-keep text-sm text-zinc-700">
          {input.pendingClaims > 0 ? (
            <>
              {m}까지 쓴 결의서 <b>{input.pendingClaims}건</b>이 아직 승인 대기 중이에요. 마감일({mdLabel(due)})까지 승인 또는 반려해 주세요. 처리하지 않으면 이번 세무 자료에서 빠지고 다음 달로 넘어가요.
            </>
          ) : (
            <>{m}까지 쓴 결의서 중 승인을 기다리는 건이 없어요.</>
          )}
        </p>
        {input.pendingClaims > 0 && (
          <Link href={`${base}/claims?tab=pending`} className={`${btn} bg-brand-600 text-white hover:bg-brand-700 sm:self-start`}>
            승인하러 가기 <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </>
    ),
    cards: (
      <>
        <p className="break-keep text-sm text-zinc-700">
          카드사 홈페이지(기업카드 메뉴)에서 <b>{m} 법인카드 이용내역</b>을 엑셀로 내려받아 올리면, 직원이 올린 영수증과 날짜·금액·카드 끝 4자리로 자동으로 맞춰 <b>결의서 없이 쓴 결제</b>를 찾아요. 처리 결과는 세무사에게 함께 넘어가요.
        </p>
        <p className="break-keep rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          다음 단계의 홈택스 &lsquo;사업용 신용카드&rsquo; 자료와는 달라요. 홈택스 자료는 세금 공제용 국세청 기록이고, 여기는 카드사 내역으로 <b>빠진 영수증을 찾는</b> 곳이에요.
        </p>
        <Link href={`${base}/corporate-cards/reconcile?month=${month}`} className={`${btn} ${input.card.kind === "done" ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50" : "bg-brand-600 text-white hover:bg-brand-700"} sm:self-start`}>
          {input.card.kind === "none" ? "카드 내역 올리고 대조하기" : input.card.kind === "open" ? "남은 건 처리하기" : "대조 결과 보기"} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </>
    ),
    hometax: (
      <>
        <HometaxFiles uploads={data.hometax} month={month} downloadBase={`${base}/export/hometax?id=`} viewer="company" uploadAction={uploadHometaxAction} deleteAction={deleteHometaxAction} guideOpen />
      </>
    ),
    handoff: input.closed ? (
      <>
        <p className="break-keep text-sm text-zinc-700">
          {m} 마감을 마쳤어요.{input.officeName ? ` ${input.officeName}가 장부·영수증·지출결의서·홈택스 자료를 받을 수 있어요.` : ""}
        </p>
        <Link href={`${base}/export?month=${month}`} className={`${btn} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 sm:self-start`}>
          세무 마감 화면에서 자료 보기 <ArrowRight className="size-4" aria-hidden />
        </Link>
      </>
    ) : input.officeName ? (
      <>
        <p className="break-keep text-sm text-zinc-700">
          마감하면 <b>{input.officeName}</b>에 알림이 가고, 세무사무소가 앱에서 장부·영수증·지출결의서·홈택스 자료를 바로 받아요. 파일을 따로 보낼 필요가 없어요.
        </p>
        <ClosingHandoffButton month={month} officeName={input.officeName} items={data.rows} />
        <Link href={`${base}/export?month=${month}`} className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 sm:self-start">
          마감 전에 장부 미리보기·우리 회사용 ZIP 받기 (세무 마감 화면)
        </Link>
      </>
    ) : (
      <>
        <p className="break-keep text-sm text-zinc-700">
          세무 마감 화면에서 <b>[{m} 세무 마감 패키지 다운로드]</b>를 누르면 마감되고 장부(엑셀)·영수증·지출결의서 묶음(ZIP)을 받아요. 받은 파일을 세무사에게 보내 주세요.
        </p>
        <Link href={`${base}/export?month=${month}`} className={`${btn} bg-brand-600 text-white hover:bg-brand-700 sm:self-start`}>
          세무 마감 화면으로 <ArrowRight className="size-4" aria-hidden />
        </Link>
        <p className="break-keep rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          세무사무소를 연결해 두면 파일을 보낼 필요 없이 [마감하고 알리기] 한 번으로 끝나요.{" "}
          <Link href={`${base}/tax-office`} className="font-medium underline underline-offset-2">
            설정 › 세무사무소
          </Link>
        </p>
      </>
    ),
  };

  return (
    <>
      <SectionHeading
        as="h1"
        title={p.current ? `${m} 마감 도우미` : `${m} 마감을 마쳤어요 🎉`}
        summary={`${m} 지출을 세무사무소에 넘기기까지 순서대로 안내해요. 세무 마감일은 ${mdLabel(due)}(직원 청구 마감 ${mdLabel(cutoff)})이에요. 앞 단계가 남아 있어도 다음 단계로 갈 수 있어요.`}
      />
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" data-closing-summary>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
          <span className="text-zinc-700">
            {p.total}단계 중 <b className="text-zinc-900">{p.done}단계 끝</b>
          </span>
          <b className="text-zinc-900" data-closing-percent>
            {p.percent}%
          </b>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label={`${m} 마감 진행률`}>
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.percent}%` }} />
        </div>
        {data.rows === 0 && input.pendingClaims === 0 && <p className="break-keep text-sm text-zinc-500">{m}에 승인된 지출이 없어요. 홈택스 자료만 있으면 올리고 마감하면 돼요.</p>}
      </section>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const cur = p.current?.key === s.key;
          return (
            <li key={s.key}>
              <details open={cur} className={`group rounded-xl border bg-white shadow-sm ${cur ? "border-brand-300 ring-1 ring-brand-200" : "border-zinc-200"}`} data-closing-step={s.key} data-done={s.done || undefined}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-green-100 text-green-700" : cur ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                    {s.done ? <Check className="size-4" aria-label="끝남" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-900">{s.title}</span>
                    <span className={`block text-xs ${s.done ? "text-green-700" : "text-zinc-500"}`}>{s.status}</span>
                  </span>
                  {!s.done && !cur && <Circle className="size-4 shrink-0 text-zinc-300" aria-hidden />}
                  <ChevronDown className="size-4 shrink-0 text-zinc-400 transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="flex min-w-0 flex-col gap-3 border-t border-zinc-100 px-4 pb-4 pt-3">{body[s.key]}</div>
              </details>
            </li>
          );
        })}
      </ol>
      <p className="text-center text-sm text-zinc-500">
        다른 달은{" "}
        <Link href={`${base}/closing?month=${prevMonth(month)}`} className="underline underline-offset-2">
          {monthLabel(prevMonth(month))}
        </Link>
        {" · "}
        <Link href={`${base}/export?month=${month}`} className="underline underline-offset-2">
          세무 마감 화면
        </Link>
      </p>
    </>
  );
}
