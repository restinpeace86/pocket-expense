import { ArrowDown, Car } from "lucide-react";
import { formatDateTimeKst } from "@/lib/claims/format";
import { routeFormula, type RouteCard } from "@/lib/expense/route";
import { formatWon } from "@/lib/format";

// 출장 경로 및 거리 산정 요약 (디지털 증빙, trip-expense.md §4.2, D-085)
// 자차 유류비 항목의 영수증 자리에 놓인다. 내비 화면 캡처 대신 출발지·도착지·거리·계산식·금액을 한 장에 담는다.
export function RouteEvidenceCard({ card, compact = false }: { card: RouteCard; compact?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-brand-200 bg-white" aria-label="출장 경로 및 거리 산정 요약">
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
        <Car className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 whitespace-nowrap">출장 경로 및 거리 산정 요약</span>
        {card.source === "manual" ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">직접 입력 거리</span>
        ) : (
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-700">길찾기 자동 계산</span>
        )}
      </figcaption>
      <div className="flex flex-col gap-3 p-3">
        <ol className="flex flex-col gap-1">
          <li className="min-w-0">
            <span className="text-xs text-zinc-500">출발</span>
            <span className="block break-words font-medium">{card.startName}</span>
            {!compact && card.startAddress && <span className="block break-words text-xs text-zinc-500">{card.startAddress}</span>}
          </li>
          <li aria-hidden className="pl-1 text-zinc-400">
            <ArrowDown className="size-4" />
          </li>
          <li className="min-w-0">
            <span className="text-xs text-zinc-500">도착</span>
            <span className="block break-words font-medium">{card.endName}</span>
            {!compact && card.endAddress && <span className="block break-words text-xs text-zinc-500">{card.endAddress}</span>}
          </li>
        </ol>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">총 주행 거리</dt>
            <dd className="font-semibold tabular-nums">
              {card.totalKm.toLocaleString("ko-KR")}km <span className="text-xs font-normal text-zinc-500">({card.roundTrip ? "왕복" : "편도"})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">정산 금액</dt>
            <dd className="font-semibold tabular-nums">{formatWon(card.amount)}</dd>
          </div>
        </dl>
        <p className="break-words text-xs text-zinc-600 tabular-nums">{routeFormula(card)}</p>
        {!compact && (
          <p className="text-xs text-zinc-500">
            {card.source === "api" ? "카카오 길찾기 추천 경로 기준" : "직원이 직접 입력한 거리"}
            {card.computedAt && ` · ${formatDateTimeKst(card.computedAt)}`}
          </p>
        )}
      </div>
    </figure>
  );
}
