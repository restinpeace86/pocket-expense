import Link from "next/link";
import { Suspense } from "react";
import { Panel } from "@/components/app-admin/app-admin-shell";
import { FeedbackStatusForm } from "@/components/app-admin/feedback-status-form";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { formatDateTimeKst } from "@/lib/claims/format";
import { FEEDBACK_CATEGORY, FEEDBACK_STATUS_LABEL, userAgentSummary, type FeedbackCategory, type FeedbackStatus } from "@/lib/feedback-desk/format";

export const metadata = { title: "의견 · WORKON 운영자" };

// 의견 보내기 (D-246): 직원·관리자가 보낸 버그 신고·기능 요청. 버그는 24시간 안에 확인(안내 문구 약속)
export default function FeedbackPage({ searchParams }: PageProps<"/app-admin/feedback">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS_TONE: Record<FeedbackStatus, string> = {
  pending: "bg-amber-50 text-amber-800",
  reviewing: "bg-sky-50 text-sky-800",
  resolved: "bg-emerald-50 text-emerald-700",
};

async function Content({ searchParams }: Pick<PageProps<"/app-admin/feedback">, "searchParams">) {
  const { admin } = await requireAppAdmin();
  const sp = await searchParams;
  const cat = sp.category === "bug" || sp.category === "feature" ? (sp.category as FeedbackCategory) : null;
  const st = sp.status === "pending" || sp.status === "reviewing" || sp.status === "resolved" ? (sp.status as FeedbackStatus) : null;
  let q = admin
    .from("feedback_logs")
    .select("id, category, content, page_url, user_agent, viewport, app_version, shot_path, status, operator_note, reporter_name, created_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (cat) q = q.eq("category", cat);
  if (st) q = q.eq("status", st);
  const { data } = await q;
  const rows = data ?? [];
  const href = (c: FeedbackCategory | null, s: FeedbackStatus | null) => {
    const p = new URLSearchParams();
    if (c) p.set("category", c);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/app-admin/feedback?${qs}` : "/app-admin/feedback";
  };
  const chip = (active: boolean) => `inline-flex min-h-10 items-center rounded-full px-3 text-sm ${active ? "bg-zinc-900 font-semibold text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`;
  return (
    <>
      <h1 className="text-2xl font-bold">의견</h1>
      <p className="-mt-4 break-keep text-sm text-zinc-600">
        직원·관리자가 머리글 [의견 보내기]로 보낸 버그 신고·기능 요청이에요. 버그 신고는 <b>24시간 안에 확인</b>한다고 안내하고 있어요. 회사 관리자는 이 목록을 보지 않아요.
      </p>
      <nav aria-label="거르기" className="flex flex-wrap gap-2">
        <Link href={href(null, st)} className={chip(!cat)}>
          전체
        </Link>
        {(["bug", "feature"] as const).map((c) => (
          <Link key={c} href={href(c, st)} className={chip(cat === c)} data-fb-filter={c}>
            {FEEDBACK_CATEGORY[c].emoji} {FEEDBACK_CATEGORY[c].label}
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-zinc-200" aria-hidden />
        <Link href={href(cat, null)} className={chip(!st)}>
          모든 상태
        </Link>
        {(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((s) => (
          <Link key={s} href={href(cat, s)} className={chip(st === s)}>
            {FEEDBACK_STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>
      <Panel title={`의견 ${rows.length}건`}>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">아직 받은 의견이 없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const c = r.category as FeedbackCategory;
              const s = r.status as FeedbackStatus;
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4" data-fb-row>
                  <div className="min-w-0 flex-1 basis-80">
                    <p className="text-sm font-semibold">
                      <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[s]}`}>{FEEDBACK_STATUS_LABEL[s]}</span>
                      {FEEDBACK_CATEGORY[c].emoji} {FEEDBACK_CATEGORY[c].label} · {r.companies?.name ?? "(회사 없음)"} · {r.reporter_name ?? "직원"}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-zinc-900">{r.content}</p>
                    <p className="mt-1.5 break-all text-xs text-zinc-500">
                      {formatDateTimeKst(r.created_at)} · {r.page_url ?? "주소 없음"} · {userAgentSummary(r.user_agent)} · {r.viewport ?? "-"} · 버전 {r.app_version ?? "-"}
                    </p>
                    {r.shot_path && (
                      <a href={`/app-admin/feedback/shot?id=${r.id}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block" data-fb-shot>
                        {/* eslint-disable-next-line @next/next/no-img-element -- 운영자 전용 캡처(운영 키 경로) */}
                        <img src={`/app-admin/feedback/shot?id=${r.id}`} alt="버그 캡처" className="h-28 max-w-full rounded-lg border border-zinc-200 bg-zinc-50 object-contain" loading="lazy" />
                      </a>
                    )}
                  </div>
                  <FeedbackStatusForm id={r.id} status={s} note={r.operator_note} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
