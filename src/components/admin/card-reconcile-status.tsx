import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { reconcileStatus, type SavedReconcile } from "@/lib/cards/saved";

// 세무 마감 화면·세무사무소 화면의 '이번 달 카드 내역 대조' 상태 (D-154). 막지는 않고 보여 준다
export function CardReconcileStatus({ saved, month, href }: { saved: SavedReconcile | null; month: string; href?: string }) {
  const s = reconcileStatus(saved);
  const [, m] = month.split("-").map(Number);
  const tone = s.kind === "open" ? "border-red-200 bg-red-50" : s.kind === "done" ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white";
  const icon =
    s.kind === "open" ? <AlertTriangle className="size-5 shrink-0 text-red-700" aria-hidden /> : s.kind === "done" ? <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden /> : <FileSpreadsheet className="size-5 shrink-0 text-brand-700" aria-hidden />;
  const text =
    s.kind === "none"
      ? { title: `${m}월 법인카드 내역 대조: 안 함`, sub: "카드사 사용 내역을 올리면 결의서가 없는 결제를 찾아 줘요. 결과는 세무사에게 함께 넘어가요." }
      : s.kind === "open"
        ? { title: `${m}월 카드 대조: 처리 안 된 ${s.open}건`, sub: `맞지 않는 ${s.total}건 중 ${s.open}건의 처리를 아직 고르지 않았어요. 고르면 세무사가 다시 묻지 않아도 돼요.` }
        : { title: `${m}월 카드 대조: ${s.total ? `맞지 않는 ${s.total}건 모두 처리됨` : "모두 맞음"}`, sub: "처리 내용이 세무 엑셀의 '카드 대조 결과'에 함께 들어가요." };
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{text.title}</b>
        <span className="block break-keep text-zinc-600">{text.sub}</span>
      </span>
      {href && <ArrowRight className="size-4 shrink-0 text-zinc-400" aria-hidden />}
    </>
  );
  return href ? (
    <Link href={href} className={`flex min-h-11 items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm hover:brightness-[0.98] ${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`flex min-h-11 items-center gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>{body}</div>
  );
}
