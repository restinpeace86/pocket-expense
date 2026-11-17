import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { won, type DocRow } from "@/lib/approval-docs/model";
import { StatusChip } from "./doc-shared";

// [결재 문서] 목록 줄(9-33e): 제목 · 종류 · 금액(있으면) · 진행 한 줄 · 상태
const day = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 10).replace("-", "/") : "");

export function DocList({ rows, href, empty, showWriter = false, showForm = false }: { rows: DocRow[]; href: (r: DocRow) => string; empty: string; showWriter?: boolean; showForm?: boolean }) {
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white" data-doc-list>
      {rows.map((r) => (
        <li key={r.id} className="border-b border-zinc-100 last:border-b-0">
          <Link href={href(r)} className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50" data-doc-row={r.id} data-status={r.status}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-1.5">
                {showForm && <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800">{r.form_name}</span>}
                <b className="truncate text-[15px]">{r.title}</b>
              </span>
              <span className="truncate text-[13px] text-zinc-600">
                {showWriter && `${r.member_name} · `}
                {r.amount !== null && `${won(r.amount)} · `}
                {r.status === "rejected" && r.rejection_reason ? `반려: ${r.rejection_reason}` : r.progress}
                {(r.submitted_at || r.updated_at) && ` · ${day(r.submitted_at ?? r.updated_at)}`}
              </span>
            </span>
            <StatusChip status={r.status} />
            <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
