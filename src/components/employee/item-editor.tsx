"use client";

import { deadlineDate, isOverdue, mdLabel, monthLabel, type DeadlinePolicy } from "@/lib/expense/deadline";
import { todayKst } from "@/lib/dates";
import { formatMaskedCard, matchCard } from "@/lib/cards/match";
import { AlertTriangle, FileText, ImageOff, Loader2, Minus, Plus, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { attachItemEvidenceAction, detachItemEvidenceAction, evidenceUploadedAction, rereadReceiptAction, saveItemAction } from "@/app/workspace/[id]/employee/claims/actions";
import { EVIDENCE_KIND_LABEL, FILE_EVIDENCE_KINDS, NO_EVIDENCE_MIN, type EvidenceKind } from "@/lib/receipts/evidence-kind";
import { processReceiptFile, RECEIPT_MAX_BYTES, TOO_LARGE_MESSAGE } from "@/lib/receipts/image";
import { createClient } from "@/lib/supabase/client";
import { receiptOriginalUrlAction } from "@/lib/claims/actions";
import { AmountInput } from "@/components/ui/amount-input";
import { inputClass } from "@/components/ui/page-shell";
import type { EditorCard, EditorClaim, EditorItem, EvidenceType, ItemInput, PaymentMethod, TripTransport } from "@/lib/employee/editor-types";
import { isMealLike, itemAmounts, type MealPolicy } from "@/lib/expense/amounts";
import { CATEGORY_LABEL, TRIP_TYPE_LABEL, type ExpenseCategory, type PurchaseType, type TripType } from "@/lib/expense/categories";
import { formatWon } from "@/lib/format";
import { evidenceReason } from "@/lib/receipts/evidence-reason";
import { guardAction } from "@/lib/action-guard";
import { noEvidenceNotice } from "@/lib/expense/evidence-penalty";
import { measureAction } from "@/lib/perf/client";

// 영수증 항목 편집 — 결의서 화면 안 인라인(아코디언) (worker-tax-processing.md §2·§3-3, smart-meal.md §4, corporate-cards.md §3, todo_improvement(2차) 3)
export const CATEGORY_ICON: Record<ExpenseCategory, string> = { meal: "🍚", trip: "🧳", meeting: "🤝", purchase: "📦", team_dinner: "🍻", condolence: "💐", seminar: "🎤", books: "📚", training: "🎓", company_car: "🚙", saas: "💻" };
// 회사차량으로 간 출장이면 톨비·주차 대신 회사차량 주유·통행료·주차(차량유지비, D-106)
const TRIP_TYPES: TripType[] = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other"];
const COMPANY_CAR_TRIP_TYPES: TripType[] = ["meal", "public_transport", "taxi", "car_fuel", "car_toll", "lodging", "other"]; // 자차 유류비는 T7
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
    evidenceKind: i.evidence_kind ?? (i.receipt_path ? "receipt" : null),
    noEvidenceReason: i.no_evidence_reason ?? "",
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
  deadline = { holidays: [] },
  claimCategory,
  tripTransport = null,
  perDiem = false,
  mismatch = false,
  busy = false,
  onAckCategory,
  onMoveCategory,
  register,
  onError,
}: {
  claim: EditorClaim;
  claimCategory: ExpenseCategory | null; // 결의서 화면에서 지금 고른 대표 카테고리(D-098). 저장 전이라도 화면은 이것을 따른다
  tripTransport?: TripTransport | null; // 출장 이동 수단(회사차량이면 세부 유형이 달라짐)
  perDiem?: boolean; // 회사가 출장 일비(식비 포함)를 쓰면 출장 식비는 고르지 않는다(D-124)
  mismatch?: boolean; // AI가 본 종류가 결의서 카테고리와 다르고 아직 확인 안 함(D-104)
  busy?: boolean;
  onAckCategory?: () => void;
  onMoveCategory?: () => void;
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
  const [kindOpen, setKindOpen] = useState(false);
  const [attaching, startAttach] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
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
    const res = await guardAction(() => measureAction("employee.save_item", () => saveItemAction(item.id, latest.current)));
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
      const res = await guardAction(() => measureAction("employee.reread_receipt", () => rereadReceiptAction(item.id)));
      if (!res.ok) onError(res.error);
      else if (!res.parsed) onError("자동 인식에 실패했어요. 직접 입력해 주세요.");
    });

  // 영수증 없이 추가한 항목에 증빙 자료 붙이기 (D-108): 경로는 DB가 정하고 여기서 올린다. AI로 읽지 않는다(직접 입력한 값 유지)
  const attach = (file: File) =>
    startAttach(async () => {
      if (!(await save())) return;
      const processed = await processReceiptFile(file).catch(() => null);
      if (!processed) return onError("올릴 수 없는 파일이에요. 사진 또는 PDF를 골라 주세요.");
      if (processed.original.size > RECEIPT_MAX_BYTES) return onError(TOO_LARGE_MESSAGE);
      const r = await guardAction(() => attachItemEvidenceAction(item.id, { isPdf: processed.kind === "pdf", thumbExt: processed.kind === "image" ? processed.thumbExt : "webp" }));
      if (!r.ok) return onError(r.error);
      const bucket = createClient().storage.from("receipts");
      const up = await bucket.upload(r.receiptPath, processed.original, { contentType: processed.kind === "pdf" ? "application/pdf" : "image/jpeg", upsert: true });
      if (up.error) {
        await detachItemEvidenceAction(item.id, { quiet: true }).catch(() => undefined);
        return onError("자료를 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      }
      if (processed.kind === "image" && r.thumbPath) {
        await bucket.upload(r.thumbPath, processed.thumb, { contentType: processed.thumbExt === "webp" ? "image/webp" : "image/jpeg", upsert: true }).catch(() => undefined);
      }
      onError(null);
      await evidenceUploadedAction().catch(() => undefined);
    });
  const detach = () =>
    startAttach(async () => {
      const r = await guardAction(() => detachItemEvidenceAction(item.id));
      if (!r.ok) onError(r.error);
    });

  const openOriginal = async () => {
    const r = await guardAction(() => receiptOriginalUrlAction(item.id));
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
        // 영수증이 없어도 증빙 자료는 있어야 한다 (D-108)
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-3 text-sm">
          <p className="font-medium text-zinc-800">
            증빙 자료<span className="ml-0.5 text-red-600">*</span>
          </p>
          {input.evidenceKind !== "none" ? (
            <>
              <p className="text-zinc-600">영수증이 없으면 대신할 자료를 올려 주세요. 인보이스·결제 메일, 앱 이용 내역, 카드 결제 내역, 청첩장·부고 안내(문자·모바일 초대장) 캡처도 돼요.</p>
              <button
                type="button"
                disabled={attaching}
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-600 px-3 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
              >
                {attaching ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                사진·PDF 올리기
              </button>
              <button type="button" onClick={() => set("evidenceKind", "none")} className="inline-flex min-h-11 items-center self-start text-zinc-500 underline underline-offset-2">
                자료가 정말 없어요
              </button>
            </>
          ) : (
            <>
              <label htmlFor={fid("noev")} className="font-medium text-zinc-800">
                증빙이 없는 사유<span className="ml-0.5 text-red-600">*</span>
              </label>
              <textarea
                id={fid("noev")}
                className={`${inputClass} min-h-16 py-2`}
                value={input.noEvidenceReason}
                maxLength={300}
                placeholder="예: 현금으로 낸 축의금이라 받은 자료가 없음"
                onChange={(e) => set("noEvidenceReason", e.target.value)}
              />
              {input.noEvidenceReason.trim().length < NO_EVIDENCE_MIN && <p className="text-xs text-zinc-500">{NO_EVIDENCE_MIN}자 이상 적어 주세요.</p>}
              {(() => {
                // 금액에 맞는 가산세 안내 + 적용 기준(D-153). 3만 원 이하는 겁주지 않는다
                const n = noEvidenceNotice(amount);
                const body = (
                  <>
                    결재 화면에 &ldquo;증빙 없음&rdquo;으로 표시되고, 세무사 자료에도 사유가 함께 넘어가요. {n.text}
                    <span className="mt-1 block text-xs opacity-80">{n.basis}</span>
                  </>
                );
                return n.level === "warn" ? (
                  <Warn>{body}</Warn>
                ) : (
                  <p className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{body}</p>
                );
              })()}
              <button type="button" onClick={() => set("evidenceKind", null)} className="self-start text-zinc-500 underline underline-offset-2">
                자료 올리기로 돌아가기
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) attach(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {/* 사진이 있으면 그 자료가 무엇인지(영수증이 아닐 때 결재자·세무사가 알 수 있게, D-108) */}
      {item.receipt_path && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-zinc-800">
              증빙 자료 <b className="ml-1 font-semibold text-zinc-900">{EVIDENCE_KIND_LABEL[(input.evidenceKind ?? "receipt") as EvidenceKind]}</b>
            </span>
            <span className="flex shrink-0 items-center">
              {item.parse_status === "none" && (
                <button type="button" disabled={attaching} onClick={detach} className="min-h-11 rounded-lg px-2 text-zinc-500 underline underline-offset-2 hover:bg-zinc-50">
                  자료 떼기
                </button>
              )}
              <button type="button" onClick={() => setKindOpen((v) => !v)} className="min-h-11 rounded-lg px-2 text-zinc-600 underline underline-offset-2 hover:bg-zinc-50">
                {kindOpen ? "닫기" : "바꾸기"}
              </button>
            </span>
          </div>
          {kindOpen && <Chips label="증빙 자료 종류" options={FILE_EVIDENCE_KINDS.map((k) => ({ value: k, label: EVIDENCE_KIND_LABEL[k] }))} value={input.evidenceKind ?? "receipt"} onChange={(v) => set("evidenceKind", v)} />}
        </div>
      )}

      {item.duplicate && <DuplicateWarning dup={item.duplicate} base={base} />}
      {/* 조용히 바꾸지 않는다(D-104): AI가 본 종류가 결의서와 다르면 직원이 정한다 */}
      {mismatch && item.aiCategory && claimCategory && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              AI는 이 영수증을 <b>{CATEGORY_LABEL[item.aiCategory]}</b>(으)로 봤어요. 이 결의서는 <b>{CATEGORY_LABEL[claimCategory]}</b>라 그대로 두면 {CATEGORY_LABEL[claimCategory]}(으)로 처리돼요.
            </span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" disabled={busy} onClick={onMoveCategory} className="min-h-11 rounded-xl bg-amber-600 px-3 font-semibold text-white disabled:opacity-60">
              새 {CATEGORY_LABEL[item.aiCategory]} 결의서로 옮기기
            </button>
            <button type="button" disabled={busy} onClick={onAckCategory} className="min-h-11 rounded-xl border border-amber-400 bg-white px-3 font-medium text-amber-900 disabled:opacity-60">
              이 결의서가 맞아요
            </button>
          </div>
        </div>
      )}

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
      {overdueAt && (
        <Warn>
          {monthLabel(input.expenseDate.slice(0, 7))} 사용분 청구 마감({mdLabel(overdueAt)})이 지났어요. 상신은 할 수 있고, 이 영수증은 {monthLabel(todayKst().slice(0, 7))} 정산(다음 세무 마감)으로 넘어가요.
        </Warn>
      )}
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
            options={(tripTransport === "company_car" ? COMPANY_CAR_TRIP_TYPES : TRIP_TYPES).filter((t) => !(perDiem && t === "meal")).map((t) => ({ value: t, label: TRIP_TYPE_LABEL[t] }))}
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
