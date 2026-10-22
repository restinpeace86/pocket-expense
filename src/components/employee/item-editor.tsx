"use client";

import { deadlineDate, isOverdue, type DeadlinePolicy } from "@/lib/expense/deadline";
import { todayKst } from "@/lib/dates";
import { formatMaskedCard, matchCard } from "@/lib/cards/match";
import { AlertTriangle, FileText, ImageOff, Loader2, Minus, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { rereadReceiptAction, saveItemAction } from "@/app/workspace/[id]/employee/claims/actions";
import { receiptOriginalUrlAction } from "@/lib/claims/actions";
import { AmountInput } from "@/components/ui/amount-input";
import { inputClass } from "@/components/ui/page-shell";
import type { EditorCard, EditorClaim, EditorItem, EvidenceType, ItemInput, PaymentMethod } from "@/lib/employee/editor-types";
import { isMealLike, itemAmounts, type MealPolicy } from "@/lib/expense/amounts";
import { CATEGORY_LABEL, TRIP_TYPE_LABEL, type ExpenseCategory, type PurchaseType, type TripType } from "@/lib/expense/categories";
import { formatWon } from "@/lib/format";
import { evidenceReason } from "@/lib/receipts/evidence-reason";
import { measureAction } from "@/lib/perf/client";

// 영수증 항목 편집 — 결의서 화면 안 인라인(아코디언) (worker-tax-processing.md §2·§3-3, smart-meal.md §4, corporate-cards.md §3, todo_improvement(2차) 3)
export const CATEGORY_ICON: Record<ExpenseCategory, string> = { meal: "🍚", trip: "🧳", meeting: "🤝", purchase: "📦", team_dinner: "🍻", condolence: "💐", seminar: "🎤", books: "📚", training: "🎓", company_car: "🚙", saas: "💻" };
const TRIP_TYPES: TripType[] = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other"]; // 자차 유류비는 T7
export const PURCHASE_TYPES: PurchaseType[] = ["pantry", "office_supplies", "small_equipment"];
const EVIDENCE: { value: EvidenceType; label: string }[] = [
  { value: "card_slip", label: "카드매출전표" },
  { value: "cash_receipt", label: "현금영수증" },
  { value: "tax_invoice", label: "세금계산서" },
  { value: "simple_receipt", label: "간이영수증" },
  { value: "other", label: "기타" },
];

function toInput(i: EditorItem): ItemInput {
  return {
    category: i.category,
    tripType: i.trip_type,
    purchaseType: i.purchase_type,
    paymentMethod: i.payment_method,
    corporateCardId: i.corporate_card_id,
    evidenceType: i.evidence_type,
    expenseDate: i.expense_date ?? "",
    merchantName: i.merchant_name ?? "",
    merchantBusinessNumber: i.merchant_business_number ?? "",
    amount: i.amount?.toString() ?? "",
    supplyAmount: i.supply_amount?.toString() ?? "",
    vatAmount: i.vat_amount?.toString() ?? "",
    headcount: i.headcount ?? 1,
    purpose: i.purpose ?? "",
    clientName: i.client_name ?? "",
    attendees: i.attendees ?? "",
    tripStartDate: i.trip_start_date ?? "",
    tripEndDate: i.trip_end_date ?? "",
  };
}

function Field({ label, required, htmlFor, children, hint }: { label: string; required?: boolean; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-full border px-3.5 text-sm ${value === o.value ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// 중복 영수증 경고 (D-079): 막지 않고 알려만 준다. 다른 직원 것은 건수만
function DuplicateWarning({ dup, base }: { dup: NonNullable<EditorItem["duplicate"]>; base: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4 shrink-0" />
        이미 올린 영수증 같아요
      </p>
      <p>승인번호(또는 가맹점·날짜·시각)와 금액이 같은 영수증이 있어요. 같은 영수증이면 이 항목을 지워 주세요. 다른 결제라면 그대로 두셔도 돼요.</p>
      {dup.mine.map((c) => (
        <Link key={c.claim_id} href={`${base}/claims/${c.claim_id}/edit`} className="underline underline-offset-2">
          내 결의서: {c.title || "제목 없는 결의서"}
        </Link>
      ))}
      {dup.others > 0 && <p>회사의 다른 직원 결의서에도 {dup.others}건 있어요.</p>}
    </div>
  );
}

// AI가 읽은 참고 정보 (D-079): 지출결의서에는 들어가지 않고 확인용으로만 보여 준다
function ReceiptDetails({ item }: { item: EditorItem }) {
  const rows: [string, string][] = [];
  if (item.paid_time) rows.push(["결제 시각", item.paid_time]);
  if (item.approval_number) rows.push(["승인번호", item.approval_number]);
  if (item.merchant_address) rows.push(["가맹점 주소", item.merchant_address]);
  if (rows.length === 0 && item.line_items.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white px-4 py-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-1 [&::-webkit-details-marker]:hidden">
        <Sparkles className="size-4 shrink-0 text-brand-700" />
        <span>
          <span className="block font-semibold">AI가 읽은 참고 정보</span>
          <span className="block text-xs text-zinc-500">결제 시각·승인번호·주소·품목 · 결의서에는 들어가지 않아요</span>
        </span>
      </summary>
      <div className="flex flex-col gap-3 pb-3 pt-1 text-sm">
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {item.line_items.length > 0 && (
          <table className="w-full table-fixed text-left">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 font-normal">품목</th>
                <th className="w-12 py-1 text-right font-normal">수량</th>
                <th className="w-24 py-1 text-right font-normal">금액</th>
              </tr>
            </thead>
            <tbody>
              {item.line_items.map((l, i) => (
                <tr key={i} className="border-t border-zinc-100">
                  <td className="break-words py-1.5 pr-2">{l.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.quantity ?? ""}</td>
                  <td className={`py-1.5 text-right tabular-nums ${l.amount !== null && l.amount < 0 ? "text-red-600" : ""}`}>{l.amount !== null ? l.amount.toLocaleString("ko-KR") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// 식대·출장 식비 1식 한도 실시간 안내 (smart-meal.md §4)
function MealCalc({ input, policy, override }: { input: ItemInput; policy: MealPolicy; override: number | null }) {
  const amount = input.amount === "" ? null : Number(input.amount);
  const r = itemAmounts({ category: input.category, tripType: input.tripType, amount, headcount: input.headcount }, policy, override);
  if (!policy.enabled) return <p className="text-sm text-zinc-600">회사 정책: 식대 한도 없이 전액 지원해요.</p>;
  if (r.appliedLimit === null || r.totalLimit === null) return null;
  const corporate = input.paymentMethod === "corporate_card";
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm">
      <p className="text-zinc-600">
        1인 한도 {formatWon(r.appliedLimit)} × {input.headcount}명 = <b className="text-zinc-900">{formatWon(r.totalLimit)}</b>
      </p>
      {amount !== null && (
        <>
          {r.appliedMode === "notify" && r.overLimit > 0 ? (
            <p className="font-medium text-orange-700">한도 초과 {formatWon(r.overLimit)} — 회사 정책상 전액 지원, 관리자에게 표시됩니다</p>
          ) : (
            <p>
              회사 지원 <b>{formatWon(r.supported ?? 0)}</b> + 개인 부담 <b className={r.burden > 0 ? "text-orange-700" : undefined}>{formatWon(r.burden)}</b>
            </p>
          )}
          <p className="text-zinc-600">
            {corporate ? (r.burden > 0 ? `개인 부담 ${formatWon(r.burden)}을 회사에 납부해야 합니다` : "추가 정산 없음") : `회사가 ${formatWon(r.supported ?? 0)}을 지급합니다`}
          </p>
        </>
      )}
    </div>
  );
}

// 영수증 한 장의 인라인 편집 (todo_improvement(2차) [개선사항 3]: 원페이지 아코디언).
// 결의서 화면의 영수증 카드 안에서 펼쳐진다. 고치면 0.8초 뒤 자동 저장하고, 접거나·임시저장·상신할 때 남은 것을 바로 저장한다(flush).
export type ItemFormHandle = { flush: () => Promise<boolean> };

export function ItemInlineForm({
  claim,
  item,
  cards,
  mealPolicy,
  mealOverride,
  base,
  deadline = { type: "none", days: null },
  claimCategory,
  register,
  onError,
}: {
  claim: EditorClaim;
  claimCategory: ExpenseCategory | null; // 결의서 화면에서 지금 고른 대표 카테고리(D-098). 저장 전이라도 화면은 이것을 따른다
  item: EditorItem;
  cards: EditorCard[];
  mealPolicy: MealPolicy;
  mealOverride: number | null;
  base: string;
  deadline?: DeadlinePolicy;
  register: (id: string, h: ItemFormHandle | null) => void; // 결의서 화면이 상신 전에 모든 펼친 영수증을 저장하려고 쓴다
  onError: (message: string | null) => void;
}) {
  const [input, setInput] = useState<ItemInput>(() => toInput(item));
  const saved = useRef(JSON.stringify(toInput(item)));
  const latest = useRef(input); // 자동 저장이 읽는 최신 입력(change에서만 바꾼다)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [rereading, startReread] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === saved.current) return true;
    setStatus("saving");
    const res = await measureAction("employee.save_item", () => saveItemAction(item.id, latest.current));
    if (!res.ok) {
      setStatus("error");
      onError(res.error);
      return false;
    }
    saved.current = snapshot;
    setStatus("saved");
    onError(null);
    return true;
  }, [item.id, onError]);

  useEffect(() => {
    register(item.id, { flush: save });
    return () => {
      register(item.id, null);
      void save(); // 접을 때 남은 것 저장
    };
  }, [item.id, register, save]);

  const change = (next: (f: ItemInput) => ItemInput) => {
    const v = next(latest.current);
    latest.current = v;
    setInput(v);
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  };
  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K]) => change((f) => ({ ...f, [k]: v }));
  const setPayment = (pm: PaymentMethod) =>
    change((f) => ({ ...f, paymentMethod: pm, corporateCardId: pm === "corporate_card" ? (f.corporateCardId ?? (cards.length === 1 ? cards[0].id : null)) : null }));

  const reread = () =>
    startReread(async () => {
      if (!(await save())) return;
      const res = await measureAction("employee.reread_receipt", () => rereadReceiptAction(item.id));
      if (!res.ok) onError(res.error);
      else if (!res.parsed) onError("자동 인식에 실패했어요. 직접 입력해 주세요.");
    });

  const openOriginal = async () => {
    const r = await receiptOriginalUrlAction(item.id);
    if (r.ok && r.url) {
      if (item.isPdf) window.open(r.url, "_blank", "noopener");
      else setZoomUrl(r.url);
    }
  };

  const amount = input.amount === "" ? null : Number(input.amount);
  const supply = input.supplyAmount === "" ? null : Number(input.supplyAmount);
  const vat = input.vatAmount === "" ? null : Number(input.vatAmount);
  const sumMismatch = amount !== null && supply !== null && vat !== null && supply + vat !== amount;
  const overdueAt = isOverdue(input.expenseDate || null, deadline, todayKst()) ? deadlineDate(input.expenseDate, deadline) : null;
  // 화면에서 쓰는 카테고리 = 결의서 카테고리(저장하면 DB 트리거가 영수증에도 같은 값을 넣는다)
  const cat = claimCategory ?? (claim.is_business_trip ? "trip" : null);
  const outsideTrip =
    cat === "trip" &&
    !!input.expenseDate &&
    ((claim.trip_start_date && input.expenseDate < claim.trip_start_date) || (claim.trip_end_date && input.expenseDate > claim.trip_end_date));
  const cardMatch = matchCard(item.aiCardMasked, cards);
  const matchedCard = cardMatch.kind === "unique" ? cards.find((c) => c.id === cardMatch.cardId) : undefined;
  const mealLike = isMealLike(cat, cat === "trip" ? input.tripType : null);
  const fid = (k: string) => `${k}-${item.id}`;
  const reason = evidenceReason(input.evidenceType, item.aiEvidence);

  return (
    <div className="flex flex-col gap-4 border-t border-zinc-100 px-3 pb-4 pt-3">
      {/* 사진: 작게 + 눌러서 원본 크게 */}
      {item.receipt_path ? (
        <div className="flex items-start gap-3">
          <button type="button" onClick={openOriginal} className="relative shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100" aria-label="영수증 크게 보기">
            {item.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크
              <img src={item.thumbUrl} alt="영수증" className="h-24 w-20 object-cover" />
            ) : (
              <span className="flex h-24 w-20 items-center justify-center text-zinc-400">{item.isPdf ? <FileText className="size-6" /> : <ImageOff className="size-6" />}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[11px] text-white">크게 보기</span>
          </button>
          <div className="min-w-0 flex-1 text-sm">
            {item.parse_status === "success" && (
              <p className="inline-flex items-start gap-1.5 text-brand-700">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                AI가 채운 값이에요. 사진과 맞는지 확인해 주세요.
              </p>
            )}
            {(item.parse_status === "failed" || item.parse_status === "parsing") && (
              <div className="flex flex-col items-start gap-2">
                <p className="text-zinc-600">{item.parse_status === "failed" ? "자동 인식에 실패했어요. 직접 입력해 주세요." : "AI가 아직 읽지 못했어요."}</p>
                <button type="button" onClick={reread} disabled={rereading} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 hover:bg-zinc-50 disabled:opacity-60">
                  {rereading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  AI로 다시 읽기
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600">영수증 없이 추가한 항목이에요. 사용 내용을 직접 입력해 주세요.</p>
      )}

      {item.duplicate && <DuplicateWarning dup={item.duplicate} base={base} />}

      <Field label="가맹점명" required htmlFor={fid("merchant")}>
        <input id={fid("merchant")} className={inputClass} value={input.merchantName} maxLength={100} placeholder="예: 스타벅스 강남점" onChange={(e) => set("merchantName", e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="사용일자" required htmlFor={fid("date")}>
          <input id={fid("date")} type="date" className={inputClass} value={input.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} />
        </Field>
        <Field label="합계 금액" required>
          <AmountInput name={fid("amount")} ariaLabel="합계 금액" value={input.amount} onChange={(v) => set("amount", v)} />
        </Field>
      </div>
      {outsideTrip && <Warn>출장 기간 밖의 날짜예요. 날짜를 확인해 주세요(그대로 상신할 수도 있어요).</Warn>}
      {overdueAt && <Warn>청구 기한({overdueAt.replaceAll("-", ".")}까지)이 지났어요. 상신은 할 수 있지만 관리자 화면에 &ldquo;기한 초과&rdquo;로 표시돼요.</Warn>}
      <details className="group rounded-xl bg-zinc-50 px-3 py-2" open={!!(input.merchantBusinessNumber || input.supplyAmount || input.vatAmount) || undefined}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
          사업자등록번호·공급가액·부가세 <span className="ml-1 text-xs font-normal text-zinc-500">(세무사 전달용 · AI가 채워요)</span>
        </summary>
        <div className="mt-2 flex flex-col gap-3 pb-2">
          <Field label="가맹점 사업자등록번호" htmlFor={fid("bn")}>
            <input id={fid("bn")} className={inputClass} inputMode="numeric" value={input.merchantBusinessNumber} maxLength={12} placeholder="숫자 10자리" onChange={(e) => set("merchantBusinessNumber", e.target.value.replace(/[^0-9-]/g, ""))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="공급가액">
              <AmountInput name={fid("supply")} ariaLabel="공급가액" value={input.supplyAmount} onChange={(v) => set("supplyAmount", v)} />
            </Field>
            <Field label="부가세">
              <AmountInput name={fid("vat")} ariaLabel="부가세" value={input.vatAmount} onChange={(v) => set("vatAmount", v)} />
            </Field>
          </div>
          {sumMismatch && <Warn>공급가액 + 부가세가 합계 금액과 달라요. 영수증을 확인해 주세요.</Warn>}
        </div>
      </details>
      {/* 증빙 구분: AI가 정하고(없으면 카드매출전표) 이유를 연하게 보여 준다. 드물게 틀리면 [바꾸기] (D-100) */}
      {input.evidenceType && !evidenceOpen ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-800">
              증빙 구분 <b className="ml-1 font-semibold text-zinc-900">{EVIDENCE.find((e) => e.value === input.evidenceType)?.label}</b>
            </span>
            <button type="button" onClick={() => setEvidenceOpen(true)} className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-zinc-600 underline underline-offset-2 hover:bg-zinc-50">
              바꾸기
            </button>
          </div>
          {reason && <p className="text-xs text-zinc-400">└ ✨ {reason}</p>}
        </div>
      ) : (
        <Field label="증빙 구분" required>
          <Chips label="증빙 구분" options={EVIDENCE} value={input.evidenceType} onChange={(v) => set("evidenceType", v)} />
          {reason && <p className="mt-1 text-xs text-zinc-400">└ ✨ {reason}</p>}
        </Field>
      )}
      {item.aiIncomeDeduction && input.evidenceType === "cash_receipt" && <Warn>소득공제용 현금영수증이에요. 지출증빙용이 아니라 회사 경비 처리 시 불이익이 있을 수 있어요.</Warn>}

      <Field label="결제수단" required>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="결제수단">
          {(
            [
              ["corporate_card", "💳 법인카드"],
              ["personal_card", "🧾 개인(사비)"],
            ] as [PaymentMethod, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={input.paymentMethod === v}
              onClick={() => setPayment(v)}
              className={`min-h-11 rounded-xl border text-sm font-medium ${input.paymentMethod === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      {item.aiCardMasked && cards.length > 0 && cardMatch.kind !== "unknown" && (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {matchedCard
            ? `💳 ${matchedCard.nickname}(${matchedCard.last4})로 인식했어요.`
            : cardMatch.kind === "ambiguous"
              ? `영수증 카드번호(${formatMaskedCard(item.aiCardMasked)})와 맞는 법인카드가 여러 장이에요. 사용한 카드를 골라 주세요.`
              : `영수증 카드번호(${formatMaskedCard(item.aiCardMasked)})가 등록된 법인카드와 달라 개인(사비)으로 골랐어요. 법인카드였다면 바꿔 주세요.`}
        </p>
      )}
      {input.paymentMethod === "corporate_card" && cards.length > 1 && (
        <Field label="사용한 카드" htmlFor={fid("card")}>
          <select id={fid("card")} className={inputClass} value={input.corporateCardId ?? ""} onChange={(e) => set("corporateCardId", e.target.value || null)}>
            <option value="">선택해 주세요</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname} ({c.last4})
              </option>
            ))}
          </select>
        </Field>
      )}

      <ReceiptDetails item={item} />

      {/* 지출 카테고리는 결의서 위에서 한 번만 고른다(D-098). 영수증에서는 출장비 세부 유형처럼 영수증마다 다른 것만 */}
      {cat === "trip" ? (
        <Field label="출장비 세부 유형" required>
          <Chips
            label="출장비 세부 유형"
            options={TRIP_TYPES.map((t) => ({ value: t, label: TRIP_TYPE_LABEL[t] }))}
            value={input.category === "trip" ? input.tripType : null}
            onChange={(v) => change((f) => ({ ...f, category: "trip", tripType: v, purchaseType: null }))}
          />
        </Field>
      ) : cat ? (
        <p className="text-sm text-zinc-600">
          {CATEGORY_ICON[cat]} {CATEGORY_LABEL[cat]} 영수증이에요{cat === "meeting" ? " · 미팅 목적·거래처·참석자는 결의서 위에서 한 번만 써요." : cat === "purchase" ? " · 구매 유형·목적·품목은 결의서 위에서 한 번만 써요." : "."}
        </p>
      ) : (
        <Warn>결의서 위에서 지출 카테고리를 먼저 골라 주세요.</Warn>
      )}
      {cat === "trip" && input.tripType === "lodging" && (
        <Field label="숙박 기간 (체크인 ~ 체크아웃)" required>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
            <input type="date" aria-label="체크인" className={`${inputClass} min-w-0`} value={input.tripStartDate} onChange={(e) => set("tripStartDate", e.target.value)} />
            <span className="hidden text-zinc-500 sm:inline">~</span>
            <input type="date" aria-label="체크아웃" className={`${inputClass} min-w-0`} value={input.tripEndDate} min={input.tripStartDate || undefined} onChange={(e) => set("tripEndDate", e.target.value)} />
          </div>
        </Field>
      )}
      {cat === "trip" && input.tripType === "other" && (
        <Field label="적요" required htmlFor={fid("purpose")}>
          <input id={fid("purpose")} className={inputClass} value={input.purpose} maxLength={200} placeholder="예: 출장 중 자료 출력비" onChange={(e) => set("purpose", e.target.value)} />
        </Field>
      )}
      {(mealLike || cat === "meeting") && (
        <Field label="인원수" required>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="인원 줄이기" disabled={input.headcount <= 1} onClick={() => set("headcount", Math.max(1, input.headcount - 1))} className="inline-flex size-11 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
              <Minus className="size-4" />
            </button>
            <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">
              {input.headcount}명
            </span>
            <button type="button" aria-label="인원 늘리기" disabled={input.headcount >= 99} onClick={() => set("headcount", Math.min(99, input.headcount + 1))} className="inline-flex size-11 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
              <Plus className="size-4" />
            </button>
          </div>
        </Field>
      )}
      {mealLike && <MealCalc input={input} policy={mealPolicy} override={mealOverride} />}

      <p className="text-right text-xs text-zinc-500" aria-live="polite">
        {status === "saving" ? "저장 중…" : status === "saved" ? "✓ 저장됨" : status === "error" ? "저장하지 못했어요" : "고치면 자동으로 저장돼요"}
      </p>

      {zoomUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal aria-label="영수증 크게 보기" onClick={() => setZoomUrl(null)}>
          <button type="button" aria-label="닫기" className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white">
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크 */}
          <img src={zoomUrl} alt="영수증 원본" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
