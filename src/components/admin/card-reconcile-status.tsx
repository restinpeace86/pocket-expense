import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { reconcileStatus, type SavedReconcile } from "@/lib/cards/saved";

// 세무 마감 화면·세무사무소 화면의 '이번 달 카드 내역 대조' 상태 (D-154). 막지는 않고 보여 준다.
// D-190: 세무사무소(href 없음)는 대조한 달만 보인다. 회사(href)는 법인카드를 쓰는 회사(recommend)면 안 한 달을 '권장' 카드로 크게 — 월말마다 하게 유도
export function CardReconcileStatus({ saved, month, href, recommend = false }: { saved: SavedReconcile | null; month: string; href?: string; recommend?: boolean }) {
  const s = reconcileStatus(saved);
  const [, m] = month.split("-").map(Number);
  if (s.kind === "none" && !href) return null;
  if (s.kind === "none" && href && recommend) {
    return (
      <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm" aria-label="법인카드 내역 대조 권장">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <b className="break-keep font-semibold text-zinc-900">{m}월 법인카드 내역 대조를 아직 안 했어요</b>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">마감 전 권장</span>
            </p>
            <p className="mt-1 break-keep text-sm text-zinc-700">
              결의서 없이 쓴 카드 결제, 사비로 잘못 올린 법인카드 결제를 마감 전에 찾을 수 있어요. 결과가 세무사에게 함께 넘어가 크로스체크가 돼요.
            </p>
            <ol className="mt-2 flex flex-col gap-0.5 text-sm text-zinc-700">
              <li>1. 카드사 홈페이지에서 {m}월 법인카드 사용 내역을 엑셀(또는 CSV)로 내려받기</li>
              <li>2. [법인카드 내역 대조]에 올리고, 맞지 않는 건의 처리 고르기</li>
            </ol>
          </div>
        </div>
        <Link href={href} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 sm:w-auto">
          카드 내역 올리고 대조하기
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    );
  }
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
