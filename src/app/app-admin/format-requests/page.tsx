import { Suspense } from "react";
import { Panel } from "@/components/app-admin/app-admin-shell";
import { FormatRequestToggle } from "@/components/app-admin/format-request-toggle";
import { FORMAT_PROGRAM_LABEL, type FormatProgram } from "@/lib/accounting-format/programs";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { formatDateTimeKst } from "@/lib/claims/format";

export const metadata = { title: "양식 접수 · PocketExpense 운영자" };

// 회계 양식 접수 (D-180): 회사가 세무 마감 화면에서 등록한 이카운트·세무사랑 엑셀 업로드 서식. 원본을 받아 맞는 파일을 준비하고 '준비 완료'를 표시한다
export default function FormatRequestsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const { data } = await admin
    .from("accounting_format_requests")
    .select("id, program, file_name, file_size, memo, requested_by_name, status, created_at, done_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const waiting = rows.filter((r) => r.status === "received").length;
  return (
    <>
      <h1 className="text-2xl font-bold">양식 접수</h1>
      <p className="-mt-4 break-keep text-sm text-zinc-600">
        회사가 세무 마감 화면에서 등록한 다른 회계 프로그램의 엑셀 업로드 서식이에요. 접수 {rows.length}건 · 준비 전 {waiting}건. 맞는 파일을 준비하면 [준비 완료로 표시]를 눌러 주세요(회사 화면에 &lsquo;준비 완료&rsquo;로 보여요).
      </p>
      <Panel title="접수 목록">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">아직 접수된 양식이 없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${r.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{r.status === "done" ? "준비 완료" : "접수됨"}</span>
                    {r.companies?.name ?? "(회사 없음)"} · {FORMAT_PROGRAM_LABEL[r.program as FormatProgram] ?? r.program}
                  </p>
                  <p className="mt-1 break-all text-sm text-zinc-800">{r.file_name}</p>
                  {r.memo && <p className="mt-1 break-keep text-sm text-zinc-700">&ldquo;{r.memo}&rdquo;</p>}
                  <p className="mt-1 text-xs text-zinc-500">
                    {r.requested_by_name ?? "관리자"} · {formatDateTimeKst(r.created_at)}
                    {r.done_at && ` · 준비 완료 ${formatDateTimeKst(r.done_at)}`}
                  </p>
                </div>
                <span className="flex flex-wrap items-start gap-2">
                  <a href={`/app-admin/format-requests/file?id=${r.id}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    원본 받기
                  </a>
                  <FormatRequestToggle id={r.id} done={r.status === "done"} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
