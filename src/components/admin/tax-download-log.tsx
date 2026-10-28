import { Download } from "lucide-react";

// 세무 자료 내려받기 기록 (D-153) — 회사 세무 마감 화면. 누가(회사 관리자·세무사무소)·언제·어느 달·무엇을·몇 건
export type TaxDownloadRow = {
  id: string;
  actor_kind: "company" | "tax_office";
  actor_name: string | null;
  office_name: string | null;
  month: string;
  kind: "preview" | "package" | "office_xlsx" | "office_zip" | "template" | "hometax";
  template_name: string | null;
  row_count: number;
  closed: boolean;
  created_at: string;
};

const KIND_LABEL: Record<TaxDownloadRow["kind"], string> = {
  preview: "엑셀 미리보기",
  package: "세무 마감 패키지(ZIP)",
  office_xlsx: "세무용 엑셀",
  office_zip: "증빙 묶음(ZIP)",
  template: "결산 양식",
  hometax: "홈택스 원본",
};
const when = (ts: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

export function TaxDownloadLog({ rows }: { rows: TaxDownloadRow[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="세무 자료 내려받은 기록">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <Download className="size-4 text-zinc-500" aria-hidden />
        세무 자료 내려받은 기록
      </h2>
      <p className="mt-0.5 text-xs text-zinc-500">우리 회사와 세무사무소가 세무 자료를 받은 기록이에요(최근 20건).</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">아직 받은 기록이 없어요.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {rows.map((r) => {
            const [y, m] = r.month.split("-").map(Number);
            return (
              <li key={r.id} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="min-w-0 break-keep text-sm text-zinc-900">
                  {y}년 {m}월 · {KIND_LABEL[r.kind]}
                  {r.template_name && ` ‘${r.template_name}’`} · {r.row_count.toLocaleString("ko-KR")}건{r.closed || r.kind === "hometax" ? "" : " (마감 전)"}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {when(r.created_at)} · {r.actor_kind === "tax_office" ? `${r.office_name ?? "세무사무소"} ${r.actor_name ?? ""}` : (r.actor_name ?? "관리자")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
