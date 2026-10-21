import { AlertTriangle, BellOff, Check, ChevronRight, Circle, ClipboardCheck, Hourglass, ReceiptText, SlidersHorizontal, Tags, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { categoryBars, changePct, checklist, type Dashboard } from "@/lib/admin/dashboard";
import { formatWon } from "@/lib/format";
import { InviteLinkCard } from "./invite-link-card";

// 관리자 홈 대시보드 (admin-dashboard.md ①, T11-1): 대표가 이번 달 경비 흐름과 처리할 일을 3초 안에 파악한다.
// 순서: 초기 설정 체크리스트(남은 것만) → (직원이 본인뿐이면) 초대 카드 → KPI 3개 → 할 일 → 카테고리 비중·직원 상위 5명 → 무료 영수증·초대 카드
const BAR_COLORS = ["bg-brand-600", "bg-sky-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-violet-500", "bg-zinc-400"];
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";

function Kpi({ href, icon, label, value, sub, warn }: { href: string; icon: ReactNode; label: string; value: string; sub: ReactNode; warn?: boolean }) {
  return (
    <Link href={href} className={`group flex flex-col gap-1 rounded-xl border bg-white p-5 shadow-sm hover:border-brand-300 ${warn ? "border-amber-300" : "border-zinc-200"}`}>
      <span className="flex items-center gap-2 text-sm text-zinc-600">
        {icon}
        {label}
        <ChevronRight className="ml-auto size-4 text-zinc-400 group-hover:text-brand-600" />
      </span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-zinc-500">{sub}</span>
    </Link>
  );
}

export function AdminHomeView({
  adminName,
  companyName,
  inviteCode,
  creditsLeft,
  creditsGranted,
  basePath,
  dashboard,
  policyToConfirm = null,
  preview = false,
}: {
  adminName: string;
  companyName: string;
  inviteCode: string;
  creditsLeft: number;
  creditsGranted: number;
  basePath: string;
  dashboard: Dashboard;
  policyToConfirm?: string[] | null; // 정산 정책을 아직 한 번도 저장하지 않았으면 현재(기본) 정책 요약 (D-068)
  preview?: boolean;
}) {
  const { kpi, todo } = dashboard;
  const [y, m] = dashboard.month.split("-");
  const monthLabel = `${Number(m)}월`;
  const onlyMe = dashboard.checklist.approved_members <= 1;
  const steps = checklist(dashboard.checklist);
  const showChecklist = steps.some((s) => !s.done && !s.optional);
  const pct = changePct(kpi.spend, kpi.spend_prev);
  const bars = categoryBars(dashboard.categories);
  const topMax = Math.max(1, ...dashboard.top_members.map((t) => t.amount));

  const todos: { show: boolean; href: string; icon: ReactNode; text: string; tone?: "warn" }[] = [
    { show: todo.pending_members > 0, href: `${basePath}/members?tab=pending`, icon: <UserPlus className="size-5" />, text: `가입 승인을 기다리는 직원 ${todo.pending_members}명`, tone: "warn" },
    { show: kpi.pending_claims > 0, href: `${basePath}/claims?tab=pending`, icon: <Hourglass className="size-5" />, text: `승인 대기 결의서 ${kpi.pending_claims}건${kpi.pending_oldest_days ? ` (가장 오래 ${kpi.pending_oldest_days}일째)` : ""}` },
    {
      show: todo.settle_claims > 0,
      href: `${basePath}/payouts`,
      icon: <Wallet className="size-5" />,
      text: `정산 대기 결의서 ${todo.settle_claims}건 · 지급 ${formatWon(kpi.unpaid_payout)}${kpi.unpaid_payback ? ` · 납부 ${formatWon(kpi.unpaid_payback)}` : ""}`,
    },
    { show: (todo.overdue_claims ?? 0) > 0, href: `${basePath}/claims?tab=pending`, icon: <AlertTriangle className="size-5" />, text: `청구 기한이 지난 항목이 든 승인 대기 결의서 ${todo.overdue_claims}건`, tone: "warn" },
    { show: todo.unmapped_items > 0, href: `${basePath}/account-titles`, icon: <Tags className="size-5" />, text: `계정과목이 정해지지 않은 항목 ${todo.unmapped_items}건 — 계정과목 매핑을 확인해 주세요`, tone: "warn" },
    { show: todo.failed_notifications > 0, href: `${basePath}/notifications?status=failed`, icon: <BellOff className="size-5" />, text: `최근 30일 알림톡 발송 실패 ${todo.failed_notifications}건`, tone: "warn" },
    { show: creditsLeft <= 20, href: `${basePath}/billing`, icon: <ReceiptText className="size-5" />, text: `무료 영수증이 ${creditsLeft}장 남았어요`, tone: "warn" },
  ];
  const visibleTodos = todos.filter((t) => t.show);

  const credits = (
    <section className={card}>
      <h2 className="font-semibold">무료 영수증</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {creditsLeft.toLocaleString("ko-KR")}장 남음 (총 {creditsGranted.toLocaleString("ko-KR")}장 · 이벤트 기간 동안 다 쓰면 100장 추가)
      </p>
    </section>
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{adminName}님, 안녕하세요</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {y}년 {monthLabel} 기준 · 사용일자 기준, 작성중·반려 결의서는 빼고 셌어요
        </p>
      </div>

      {showChecklist && (
        <section className={card} aria-labelledby="setup-title">
          <h2 id="setup-title" className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="size-5 text-brand-600" />
            처음 설정 ({steps.filter((s) => s.done && !s.optional).length}/{steps.filter((s) => !s.optional).length})
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.key}>
                <Link href={`${basePath}${s.href}`} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${s.done ? "text-zinc-500" : "bg-zinc-50 font-medium hover:bg-zinc-100"}`}>
                  {s.done ? <Check className="size-4 text-green-600" /> : <Circle className="size-4 text-zinc-400" />}
                  <span className={s.done ? "line-through" : ""}>{s.label}</span>
                  {s.optional && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">선택</span>}
                  {!s.done && <ChevronRight className="ml-auto size-4 text-zinc-400" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {policyToConfirm && (
        <Link href={`${basePath}/settings`} className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-brand-900 hover:bg-brand-100">
          <SlidersHorizontal className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">정산 정책을 확인해 주세요</span>
            <span className="mt-0.5 block text-sm">
              지금은 기본값으로 운영돼요: {policyToConfirm.join(" · ")}. 우리 회사 규정과 다르면 바꾸고, 그대로 써도 되면 [저장]만 누르세요.
            </span>
          </span>
          <ChevronRight className="mt-0.5 size-5 shrink-0" />
        </Link>
      )}

      {onlyMe && <InviteLinkCard inviteCode={inviteCode} companyName={companyName} preview={preview} />}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="이번 달 숫자">
        <Kpi
          href={`${basePath}/claims`}
          icon={<ReceiptText className="size-4" />}
          label={`${monthLabel} 총 지출`}
          value={formatWon(kpi.spend)}
          sub={
            pct === null ? (
              "지난달 기록 없음"
            ) : (
              <span className={pct > 0 ? "text-red-600" : pct < 0 ? "text-blue-600" : ""}>
                지난달 대비 {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct)}% ({formatWon(kpi.spend_prev)})
              </span>
            )
          }
        />
        <Kpi
          href={`${basePath}/claims?tab=pending`}
          icon={<Hourglass className="size-4" />}
          label="승인 대기"
          value={`${kpi.pending_claims}건`}
          sub={kpi.pending_claims ? `가장 오래 기다린 건 ${kpi.pending_oldest_days ?? 0}일째` : "기다리는 결의서가 없어요"}
          warn={(kpi.pending_oldest_days ?? 0) >= 7}
        />
        <Kpi
          href={`${basePath}/payouts`}
          icon={<Wallet className="size-4" />}
          label="미지급 사비 정산"
          value={formatWon(kpi.unpaid_payout)}
          sub={kpi.unpaid_payback ? `받을 법인카드 개인 부담 ${formatWon(kpi.unpaid_payback)}` : "승인됐지만 아직 이체하지 않은 금액"}
        />
      </section>

      <section className={card} aria-labelledby="todo-title">
        <h2 id="todo-title" className="font-semibold">
          할 일
        </h2>
        {visibleTodos.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">지금 처리할 일이 없어요.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {visibleTodos.map((t) => (
              <li key={t.text}>
                <Link href={t.href} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-zinc-50 ${t.tone === "warn" ? "text-amber-900" : "text-zinc-800"}`}>
                  <span className={t.tone === "warn" ? "text-amber-600" : "text-zinc-500"}>{t.icon}</span>
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={card} aria-labelledby="cat-title">
          <h2 id="cat-title" className="font-semibold">
            {monthLabel} 카테고리별 지출
          </h2>
          {bars.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">이번 달 지출이 아직 없어요.</p>
          ) : (
            <>
              {/* 비중 띠: 카테고리 비율 한눈에 */}
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={bars.map((b) => `${b.label} ${b.share}%`).join(", ")}>
                {bars.map((b, i) => (
                  <span key={b.key} className={BAR_COLORS[i % BAR_COLORS.length]} style={{ width: `${b.share}%` }} />
                ))}
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {bars.map((b, i) => (
                  <li key={b.key} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`size-2.5 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} />
                        {b.label}
                      </span>
                      <span className="tabular-nums">
                        {formatWon(b.amount)} <span className="text-zinc-500">({b.share}%)</span>
                      </span>
                    </span>
                    {b.parts.length > 0 && (
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 pl-4 text-xs text-zinc-500">
                        {b.parts.map((p) => (
                          <span key={p.label} className="tabular-nums">
                            {p.label} {formatWon(p.amount)}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className={card} aria-labelledby="top-title">
          <h2 id="top-title" className="font-semibold">
            {monthLabel} 직원별 상위 5명
          </h2>
          {dashboard.top_members.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">이번 달 지출이 아직 없어요.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-3">
              {dashboard.top_members.map((t, i) => (
                <li key={`${t.name}-${i}`} className="flex flex-col gap-1 text-sm">
                  <span className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <b className="mr-1 tabular-nums text-zinc-400">{i + 1}</b>
                      {t.name}
                      {t.department && <span className="ml-1 text-zinc-500">{t.department}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatWon(t.amount)} <span className="text-zinc-500">· {t.count}건</span>
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round((t.amount / topMax) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {(kpi.pending_oldest_days ?? 0) >= 7 && (
        <p className="flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="size-4" /> 일주일 넘게 기다린 결의서가 있어요. 직원이 사비를 오래 기다리지 않게 먼저 처리해 주세요.
        </p>
      )}

      {credits}
      {!onlyMe && <InviteLinkCard inviteCode={inviteCode} companyName={companyName} preview={preview} compact />}
    </>
  );
}
