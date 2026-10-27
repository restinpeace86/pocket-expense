import { Suspense } from "react";
import { AppAdminShell, Panel } from "@/components/app-admin/app-admin-shell";
import { ReviewToggle } from "@/components/app-admin/review-toggle";
import { authorLabel, featureLabel } from "@/lib/feedback-survey";
import { requireAppAdmin } from "@/lib/app-admin/guard";

export const metadata = { title: "후기·설문 · PocketExpense 운영자" };

// 후기·설문 (D-130): 회사별 설문 결과와 랜딩 노출 관리. 숨김(is_displayed)만 바꿀 수 있다
export default function ReviewsPage() {
  return (
    <AppAdminShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content />
      </Suspense>
    </AppAdminShell>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const { data } = await admin
    .from("feedback_surveys")
    .select("id, rating, useful_feature, industry, company_size, job_role, review, display_consent, is_displayed, created_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const shown = rows.filter((r) => r.display_consent && r.is_displayed && r.review).length;
  return (
    <>
      <h1 className="text-2xl font-bold">후기·설문</h1>
      <p className="-mt-4 text-sm text-zinc-600">
        설문 {rows.length}건 · 랜딩에 보이는 후기 {shown}건(소개 동의 + 숨기지 않음 + 한 줄 후기 있음, 최신 6건). 부적절한 후기는 [랜딩에서 숨기기]로 내려요.
      </p>
      <Panel title="설문 결과">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">아직 설문이 없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {"★".repeat(r.rating)}
                    <span className="text-zinc-300">{"★".repeat(5 - r.rating)}</span>
                    <span className="ml-2 font-normal text-zinc-600">{r.companies?.name ?? "(회사 없음)"}</span>
                  </p>
                  <p className="mt-1 break-keep text-sm text-zinc-800">{r.review ? `“${r.review}”` : <span className="text-zinc-400">(후기 없음)</span>}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {authorLabel(r)} · 유용한 기능: {featureLabel(r.useful_feature)} · {new Date(r.created_at).toLocaleDateString("ko-KR")}
                    {!r.display_consent && " · 소개 동의 안 함"}
                    {r.display_consent && !r.is_displayed && " · 숨김"}
                  </p>
                </div>
                {r.display_consent && r.review && <ReviewToggle id={r.id} displayed={r.is_displayed} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
