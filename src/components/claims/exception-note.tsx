import { exceptionFlags, exceptionSummary } from "@/lib/expense/exceptions";

// 결의서 상세의 예외 사용 표시 + 예외 소명 사유 (D-084). 둘 다 없으면 아무것도 그리지 않는다
export function ExceptionNote({ memo, items }: { memo: string | null; items: { expense_date: string | null; paid_time: string | null }[] }) {
  const summary = exceptionSummary(exceptionFlags(items));
  if (!memo && !summary) return null;
  return (
    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {summary && <p className="font-medium">{summary}</p>}
      <p className="whitespace-pre-wrap">예외 소명 사유: {memo || "적지 않음"}</p>
    </div>
  );
}
