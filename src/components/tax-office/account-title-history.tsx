import { History } from "lucide-react";
import { classificationLabel, type Classification } from "@/lib/expense/categories";

// 세무사무소가 바꾼 계정과목·분류 연결 이력 (D-152) — 회사 계정과목 화면·사무소 계정과목 화면 공용
export type AccountTitleChange = {
  id: string;
  entity: "title" | "mapping" | "item";
  action: "insert" | "update" | "delete";
  detail: Record<string, string | null>;
  actor_name: string | null;
  office_name: string | null;
  created_at: string;
};

const code = (c: string | null | undefined) => (c ? `코드 ${c}` : "코드 없음");

export function describeChange(c: AccountTitleChange): string {
  const d = c.detail;
  if (d.summary) return `${d.summary}${d.count ? ` (${d.count}군데)` : ""}`; // 연결될 때 기본값 적용 요약(D-167)
  if (c.entity === "item") {
    const amt = d.amount ? ` ${Number(d.amount).toLocaleString("ko-KR")}원` : "";
    return `영수증 ${d.expense_date ?? ""} ${d.merchant ?? ""}${amt}: ${d.old_title ?? "(없음)"} → ${d.new_title ?? "(없음)"}${d.reverted ? " (분류 기준으로 되돌림)" : ""}`;
  }
  if (c.entity === "mapping") {
    const label = d.category
      ? classificationLabel({ category: d.category, tripType: d.trip_type ?? null, purchaseType: d.purchase_type ?? null, condolenceTarget: d.condolence_target ?? null } as Classification)
      : "분류";
    return `${label}: ${d.old_title ?? "(없음)"} → ${d.new_title ?? "(없음)"}`;
  }
  if (c.action === "insert") return `계정과목 추가: ${d.new_name} (${code(d.new_code)})`;
  if (c.action === "delete") return `계정과목 삭제: ${d.old_name}`;
  const parts: string[] = [];
  if (d.old_name !== d.new_name) parts.push(`이름 ${d.old_name} → ${d.new_name}`);
  if (d.old_code !== d.new_code) parts.push(`${code(d.old_code)} → ${code(d.new_code)}`);
  return `${d.new_name}: ${parts.join(", ") || "변경"}`;
}

const when = (ts: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

export function AccountTitleHistory({ changes }: { changes: AccountTitleChange[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="세무사무소 변경 이력">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <History className="size-4 text-zinc-500" aria-hidden />
        세무사무소 변경 이력
      </h2>
      {changes.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">아직 세무사무소가 바꾼 내용이 없어요.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 py-2.5">
              <span className="break-keep text-sm text-zinc-900">{describeChange(c)}</span>
              <span className="text-xs text-zinc-500">
                {when(c.created_at)} · {c.actor_name ?? "세무사무소"}
                {c.office_name && ` (${c.office_name})`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
