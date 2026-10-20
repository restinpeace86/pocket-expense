"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, FileText, ImageIcon, Loader2, PenLine, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { receiptOriginalUrlAction } from "@/lib/claims/actions";
import type { DetailItem } from "@/lib/claims/types";
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL } from "@/lib/expense/categories";
import { formatWon } from "@/lib/format";

// 소명서 항목 목록 + 영수증 패널 (admin-expense-approvals.md §4.C, employee-mobile.md ④)
const EVIDENCE_LABEL: Record<string, string> = { card_slip: "카드매출전표", cash_receipt: "현금영수증", tax_invoice: "세금계산서", simple_receipt: "간이영수증", other: "기타" };

export function classLabel(i: DetailItem): string {
  if (!i.category) return "-";
  if (i.category === "trip" && i.trip_type) return `${CATEGORY_LABEL.trip} · ${TRIP_TYPE_LABEL[i.trip_type]}`;
  if (i.category === "purchase" && i.purchase_type) return `${CATEGORY_LABEL.purchase} · ${PURCHASE_TYPE_LABEL[i.purchase_type]}`;
  return CATEGORY_LABEL[i.category];
}

// 식대 한도 초과 금액 (적용된 1인 한도 × 인원)
export function overLimit(i: DetailItem): number {
  if (i.applied_meal_limit_per_person === null || i.amount === null) return 0;
  return Math.max(i.amount - i.applied_meal_limit_per_person * Math.max(i.headcount ?? 1, 1), 0);
}

// AI가 읽은 값과 직원이 확정한 값이 다른 칸 (D-037)
export function editedFields(i: DetailItem): string[] {
  const ai = i.ai;
  if (!ai) return [];
  const out: string[] = [];
  const diff = (a: unknown, b: unknown) => a !== null && a !== undefined && a !== "" && b !== null && String(a) !== String(b);
  if (diff(ai.merchant_name, i.merchant_name)) out.push("가맹점");
  if (diff(ai.amount, i.amount)) out.push("금액");
  if (diff(ai.expense_date, i.expense_date)) out.push("사용일");
  if (diff(ai.merchant_business_number, i.merchant_business_number)) out.push("사업자번호");
  return out;
}

function paymentBadge(i: DetailItem, cards: { id: string; nickname: string; last4: string }[]) {
  if (i.payment_method === "personal_card") return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-800">👤 개인(사비)</span>;
  const card = cards.find((c) => c.id === i.corporate_card_id);
  return <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">💳 법인{card ? ` · ${card.nickname} ${card.last4}` : ""}</span>;
}

// 처리 상태 / 정산 안내 (§4.C)
export function settlementNote(i: DetailItem): { text: string; warn: string | null } {
  const over = overLimit(i);
  const warn = over > 0 ? (i.applied_meal_limit_mode === "notify" ? `⚠️ 한도 초과 ${formatWon(over)} (전액 지원)` : `⚠️ 한도초과 ${formatWon(over)} 절사`) : null;
  if (i.payment_method === "corporate_card") return { text: i.personal_burden_amount > 0 ? `개인 부담 ${formatWon(i.personal_burden_amount)} 납부` : "법인카드 (정산 없음)", warn };
  return { text: `${formatWon(i.company_supported_amount ?? i.amount ?? 0)} 지급`, warn };
}

function ItemBadges({ i, flagged }: { i: DetailItem; flagged: boolean }) {
  const badges: [string, string][] = [];
  if (flagged) badges.push(["반려 시 지목됨", "bg-red-100 text-red-700"]);
  if (i.duplicate) badges.push(["중복 의심", "bg-amber-200 text-amber-900"]);
  const edited = editedFields(i);
  if (edited.length) badges.push([`직원 수정: ${edited.join("·")}`, "bg-violet-100 text-violet-800"]);
  if (i.amount !== null && i.supply_amount !== null && i.vat_amount !== null && i.supply_amount + i.vat_amount !== i.amount) badges.push(["합계≠공급가+부가세", "bg-amber-100 text-amber-800"]);
  if (!i.merchant_business_number) badges.push(["사업자번호 없음", "bg-zinc-100 text-zinc-500"]);
  if (!i.receipt_path) badges.push(["영수증 없음", "bg-zinc-100 text-zinc-500"]);
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map(([t, c]) => (
        <span key={t} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>
          {t}
        </span>
      ))}
    </span>
  );
}

function Thumb({ i, onOpen }: { i: DetailItem; onOpen: () => void }) {
  const cls = "size-12 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 object-cover";
  return (
    <button type="button" onClick={onOpen} aria-label="영수증 보기" className="relative shrink-0">
      {i.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크
        <img src={i.thumbUrl} alt="" className={cls} />
      ) : (
        <span className={`${cls} inline-flex items-center justify-center text-zinc-400`}>
          {i.isPdf ? <FileText className="size-5" /> : i.receipt_path ? <ImageIcon className="size-5" /> : <PenLine className="size-5" />}
        </span>
      )}
      <Search className="absolute -bottom-1 -right-1 size-5 rounded-full bg-white p-0.5 text-zinc-600 shadow" />
    </button>
  );
}

function ReceiptPanel({ items, index, cards, onIndex, onClose, showAccount }: { items: DetailItem[]; index: number; cards: { id: string; nickname: string; last4: string }[]; onIndex: (n: number) => void; onClose: () => void; showAccount: boolean }) {
  const i = items[index];
  const [url, setUrl] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!i.receipt_path) return;
    receiptOriginalUrlAction(i.id).then((r) => alive && setUrl({ id: i.id, url: r.ok ? r.url : null }));
    return () => {
      alive = false;
    };
  }, [i.id, i.receipt_path]);
  const loading = !!i.receipt_path && url?.id !== i.id;
  const photo = url?.id === i.id ? url.url : null;
  const ai = i.ai ?? {};
  const edited = editedFields(i);
  const rows: [string, React.ReactNode, unknown?][] = [
    ["가맹점", i.merchant_name, ai.merchant_name],
    ["사업자등록번호", i.merchant_business_number, ai.merchant_business_number],
    ["사용일", [i.expense_date, i.paid_time].filter(Boolean).join(" "), ai.expense_date],
    ["합계", i.amount !== null ? formatWon(i.amount) : null, ai.amount],
    ["공급가액 / 부가세", `${i.supply_amount !== null ? formatWon(i.supply_amount) : "-"} / ${i.vat_amount !== null ? formatWon(i.vat_amount) : "-"}`],
    ["증빙 구분", i.evidence_type ? EVIDENCE_LABEL[i.evidence_type] : null],
    ["결제수단", paymentBadge(i, cards)],
    ["카테고리", classLabel(i)],
    ...(showAccount ? ([["계정과목", i.account_title_name ? `${i.account_title_name}${i.account_title_code ? ` (${i.account_title_code})` : ""}${i.account_title_overridden ? " · 계정 조정됨" : ""}` : "미지정"]] as [string, React.ReactNode][]) : []),
    ["인원 · 목적", [i.headcount ? `${i.headcount}명` : null, i.purpose, i.client_name, i.attendees].filter(Boolean).join(" · ") || null],
    ["승인번호", i.approval_number],
    ["가맹점 주소", i.merchant_address],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal aria-label="영수증 보기">
      <div className="flex max-h-dvh w-full max-w-5xl flex-col overflow-hidden bg-white sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2">
          <p className="min-w-0 truncate font-semibold">
            영수증 {index + 1} / {items.length} · {i.merchant_name ?? "가맹점 미입력"}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label="이전 영수증" disabled={index === 0} onClick={() => onIndex(index - 1)} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100 disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="다음 영수증" disabled={index === items.length - 1} onClick={() => onIndex(index + 1)} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100 disabled:opacity-30">
              <ChevronRight className="size-5" />
            </button>
            <button type="button" aria-label="닫기" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2">
          <div className="flex min-h-64 items-center justify-center bg-zinc-100 p-3">
            {!i.receipt_path ? (
              <p className="text-sm text-zinc-500">영수증 없이 추가한 항목이에요.</p>
            ) : loading ? (
              <Loader2 className="size-6 animate-spin text-zinc-400" />
            ) : !photo ? (
              <p className="text-sm text-zinc-500">사진을 불러오지 못했어요.</p>
            ) : i.isPdf ? (
              <a href={photo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium shadow">
                <FileText className="size-5" />
                PDF 영수증 새 창으로 열기
              </a>
            ) : (
              <a href={photo} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크 */}
                <img src={photo} alt="영수증 원본" className="max-h-[70vh] w-auto rounded-lg" />
              </a>
            )}
          </div>
          <div className="flex flex-col gap-4 p-4 text-sm">
            {edited.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2 text-violet-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                직원이 AI가 읽은 값과 다르게 고친 칸: {edited.join(", ")}
              </p>
            )}
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
              {rows.map(([k, v, aiV]) => (
                <div key={k} className="contents">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="min-w-0 break-words">
                    {v ?? <span className="text-zinc-400">-</span>}
                    {aiV !== undefined && aiV !== null && String(aiV) !== "" && edited.length > 0 && (k === "가맹점" || k === "합계" || k === "사용일" || k === "사업자등록번호") && (
                      <span className="block text-xs text-zinc-400">AI: {k === "합계" && typeof aiV === "number" ? formatWon(aiV) : String(aiV)}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {i.line_items.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">품목 (AI가 읽은 참고 정보)</p>
                <table className="w-full table-fixed text-left">
                  <tbody>
                    {i.line_items.map((l, n) => (
                      <tr key={n} className="border-t border-zinc-100">
                        <td className="break-words py-1 pr-2">{l.name}</td>
                        <td className="w-10 py-1 text-right tabular-nums">{l.quantity ?? ""}</td>
                        <td className={`w-24 py-1 text-right tabular-nums ${l.amount !== null && l.amount < 0 ? "text-red-600" : ""}`}>{l.amount !== null ? l.amount.toLocaleString("ko-KR") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 관리자만 계정과목을 보고 바꾼다 (account-titles.md §4: 직원·결재자 화면에는 보여 주지 않음)
function AccountCell({ i, titles, onChange, busy }: { i: DetailItem; titles: AccountTitleOption[]; onChange?: (itemId: string, titleId: string | null) => void; busy: boolean }) {
  if (!onChange) return <span className="text-xs text-zinc-500">{i.account_title_name ?? "계정과목 미지정"}</span>;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      <select
        aria-label={`${i.merchant_name ?? "항목"} 계정과목`}
        disabled={!!i.closed_month}
        title={i.closed_month ? `${i.closed_month} 세무 마감된 항목이라 바꿀 수 없어요` : undefined}
        value={i.account_title_id ?? ""}
        onChange={(e) => onChange(i.id, e.target.value || null)}
        className="min-h-9 max-w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs disabled:bg-zinc-100"
      >
        <option value="">{i.account_title_overridden ? "자동(분류 기준)으로 되돌리기" : "계정과목 미지정"}</option>
        {titles.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.code ? ` (${t.code})` : ""}
          </option>
        ))}
      </select>
      {i.account_title_overridden && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800">계정 조정됨</span>}
      {busy && <span className="text-[11px] text-zinc-400">저장 중…</span>}
    </span>
  );
}

export type AccountTitleOption = { id: string; name: string; code: string | null };

export function ClaimItems({
  items,
  cards,
  flaggedIds = [],
  selectable = false,
  selected = [],
  onToggle,
  accountTitles,
  onAccountChange,
  accountBusyId,
}: {
  items: DetailItem[];
  cards: { id: string; nickname: string; last4: string }[];
  flaggedIds?: string[];
  selectable?: boolean; // 반려할 때 문제 항목 지목
  selected?: string[];
  onToggle?: (id: string) => void;
  accountTitles?: AccountTitleOption[]; // 넘기면 관리자 화면: 계정과목 표시·조정
  onAccountChange?: (itemId: string, titleId: string | null) => void;
  accountBusyId?: string | null;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const showAccount = !!accountTitles;
  return (
    // 화면 폭이 아니라 이 영역의 폭으로 표/카드를 고른다(관리자 분할 화면에서 오른쪽이 좁을 때 카드)
    <div className="@container">
      {/* 넓은 영역: 표 */}
      <div className="hidden overflow-x-auto @3xl:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              {selectable && <th className="border-b border-zinc-200 px-2 py-2 font-medium">지목</th>}
              <th className="border-b border-zinc-200 px-2 py-2 font-medium">영수증</th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium">사용일</th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium">가맹점 · 결제수단</th>
              <th className="border-b border-zinc-200 px-2 py-2 text-right font-medium">청구금액</th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium">{showAccount ? "분류 · 계정과목" : "분류"}</th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium">처리 상태 / 정산 안내</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => {
              const note = settlementNote(i);
              const flagged = flaggedIds.includes(i.id);
              return (
                <tr key={i.id} className={flagged ? "bg-red-50" : selected.includes(i.id) ? "bg-amber-50" : undefined}>
                  {selectable && (
                    <td className="border-b border-zinc-100 px-2 py-2 align-top">
                      <input type="checkbox" className="size-5" aria-label={`${i.merchant_name ?? "항목"} 지목`} checked={selected.includes(i.id)} onChange={() => onToggle?.(i.id)} />
                    </td>
                  )}
                  <td className="border-b border-zinc-100 px-2 py-2 align-top">
                    <Thumb i={i} onOpen={() => setOpen(n)} />
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-2 align-top">{i.expense_date?.slice(5).replace("-", "/") ?? "-"}</td>
                  <td className="border-b border-zinc-100 px-2 py-2 align-top">
                    <span className="block font-medium">{i.merchant_name ?? "-"}</span>
                    <span className="mt-1 flex flex-wrap gap-1">{paymentBadge(i, cards)}</span>
                    <span className="mt-1 block">
                      <ItemBadges i={i} flagged={flagged} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-2 text-right align-top font-semibold tabular-nums">{i.amount !== null ? formatWon(i.amount) : "-"}</td>
                  <td className="border-b border-zinc-100 px-2 py-2 align-top">
                    <span className="block">{classLabel(i)}</span>
                    {showAccount && <AccountCell i={i} titles={accountTitles} onChange={onAccountChange} busy={accountBusyId === i.id} />}
                  </td>
                  <td className="border-b border-zinc-100 px-2 py-2 align-top">
                    <span className="block">{note.text}</span>
                    {note.warn && <span className="text-xs font-medium text-orange-700">{note.warn}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 좁은 영역: 카드 */}
      <ul className="flex flex-col gap-2 @3xl:hidden">
        {items.map((i, n) => {
          const note = settlementNote(i);
          const flagged = flaggedIds.includes(i.id);
          return (
            <li key={i.id} className={`flex gap-3 rounded-2xl border p-3 ${flagged ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"}`}>
              {selectable && <input type="checkbox" className="mt-1 size-5 shrink-0" aria-label={`${i.merchant_name ?? "항목"} 지목`} checked={selected.includes(i.id)} onChange={() => onToggle?.(i.id)} />}
              <Thumb i={i} onOpen={() => setOpen(n)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{i.merchant_name ?? "가맹점 미입력"}</p>
                  <p className="shrink-0 font-semibold tabular-nums">{i.amount !== null ? formatWon(i.amount) : "-"}</p>
                </div>
                <p className="text-xs text-zinc-500">
                  {[i.expense_date?.replaceAll("-", "."), classLabel(i)].filter(Boolean).join(" · ")}
                </p>
                {showAccount && <AccountCell i={i} titles={accountTitles} onChange={onAccountChange} busy={accountBusyId === i.id} />}
                <div className="mt-1 flex flex-wrap items-center gap-1">{paymentBadge(i, cards)}</div>
                <p className="mt-1 text-xs text-zinc-700">
                  {note.text}
                  {note.warn && <span className="ml-1 font-medium text-orange-700">{note.warn}</span>}
                </p>
                <div className="mt-1">
                  <ItemBadges i={i} flagged={flagged} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {open !== null && <ReceiptPanel items={items} index={open} cards={cards} onIndex={setOpen} onClose={() => setOpen(null)} showAccount={showAccount} />}
    </div>
  );
}
