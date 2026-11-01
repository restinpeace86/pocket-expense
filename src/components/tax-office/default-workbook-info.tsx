"use client";

import { ChevronLeft, ChevronRight, ExternalLink, FileSpreadsheet, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MAIN_TAB } from "@/lib/tax/main-sheet";

// links: 줄마다 영수증 사진 주소(있으면 줄 번호 옆 돋보기, D-193)
export type PreviewSheet = { sheet: string; note: string; rows: string[][]; totalRows: number; links?: (string | null)[] };

// 엑셀 열 이름 A, B, …, Z, AA, AB …
const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

// 결산 양식 화면 맨 위: 지금 고객사에 나가는 양식(D-185 → D-186 → D-189). 세무용 엑셀을 예시 지출로 실제로 만들어 시트 그대로 보여 준다.
// mainName = 사무소가 고른 결산 양식(없으면 더존 위하고 일반전표), picker = 사무소 관리자의 고르기
export function DefaultWorkbookInfo({ sheets, mainName, picker }: { sheets: PreviewSheet[]; mainName: string | null; picker?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="지금 고객사에 나가는 양식">
      <h2 className="font-semibold">지금 고객사에 나가는 양식</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        {mainName
          ? `고객사 세무용 엑셀의 회계 프로그램 시트는 우리 사무소 양식 [${mainName}]대로 채워져요.`
          : "고객사 세무용 엑셀의 회계 프로그램 시트는 더존 위하고 일반전표 [엑셀올리기]용이에요."}
      </p>
      {picker}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <FileSpreadsheet className="size-4 shrink-0 text-emerald-700" aria-hidden />
          세무용 엑셀 미리보기
        </p>
        <p className="break-keep text-xs text-zinc-500">예시 지출 3건(법인카드 1건 · 사비 2건)으로 실제 파일을 만들어 그대로 보여 드려요. 고객사 [세무 자료] › [세무용 엑셀 다운로드]로 받는 파일과 같은 모양이에요.</p>
      </div>
      <WorkbookViewer sheets={sheets} initialTab={MAIN_TAB} />
    </section>
  );
}

// 엑셀 모양 보기: 시트 탭 · 열 문자 · 줄 번호 · 첫 줄 머리글(D-186). 세무 자료 화면에서도 씀(D-187).
// tabBadges: 시트 이름 → 탭 옆 작은 표시(회사 화면의 "세무사무소용", D-192)
export function WorkbookViewer({ sheets, moreHint = "", initialTab = 0, tabBadges = {} }: { sheets: PreviewSheet[]; moreHint?: string; initialTab?: number; tabBadges?: Record<string, string> }) {
  const [tab, setTab] = useState(initialTab < sheets.length ? initialTab : 0);
  const [viewing, setViewing] = useState<number | null>(null); // 영수증 팝업으로 보는 줄(D-193 보완)
  const s = sheets[tab];
  const width = Math.max(0, ...s.rows.map((r) => r.length));
  return (
    <>
      {viewing !== null && s.links?.[viewing] && <ReceiptModal sheet={s} row={viewing} onMove={setViewing} onClose={() => setViewing(null)} />}
      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-zinc-200" role="tablist" aria-label="시트">
        {sheets.map((x, i) => (
          <button
            key={x.sheet}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => {
              setTab(i);
              setViewing(null);
            }}
            className={`-mb-px min-h-10 shrink-0 whitespace-nowrap rounded-t-lg border px-3 text-sm ${
              i === tab ? "border-zinc-200 border-b-white bg-white font-semibold text-emerald-800" : "border-transparent text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {x.sheet}
            {tabBadges[x.sheet] && <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">{tabBadges[x.sheet]}</span>}
          </button>
        ))}
      </div>
      {s.note && <p className="mt-2 break-keep text-xs text-zinc-600">{s.note}</p>}

      <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-zinc-300" role="tabpanel" aria-label={`${s.sheet} 시트`}>
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-9 border border-zinc-300 bg-zinc-100" aria-hidden />
              {Array.from({ length: width }, (_, k) => (
                <th key={k} className="sticky top-0 z-10 min-w-12 border border-zinc-300 bg-zinc-100 px-2 py-1 font-normal text-zinc-500">
                  {colName(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r, i) => (
              <tr key={i}>
                <th className="sticky left-0 z-10 border border-zinc-300 bg-zinc-100 px-1.5 py-1 text-right font-normal text-zinc-500">
                  <span className="inline-flex items-center justify-end gap-1">
                    {s.links?.[i] && (
                      <button
                        type="button"
                        onClick={() => setViewing(i)}
                        aria-label={`${i + 1}행 영수증 보기`}
                        title="영수증 보기"
                        className="inline-flex size-6 items-center justify-center rounded-md bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                      >
                        <Search className="size-3.5" aria-hidden />
                      </button>
                    )}
                    {i + 1}
                  </span>
                </th>
                {Array.from({ length: width }, (_, k) => {
                  const v = r[k] ?? "";
                  const num = /^-?[\d,]+$/.test(v) && v.length > 0;
                  return (
                    <td
                      key={k}
                      title={v.length > 24 ? v : undefined}
                      className={`max-w-56 truncate whitespace-nowrap border border-zinc-200 px-2 py-1 ${i === 0 && s.rows.length > 1 && width > 2 ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-800"} ${num ? "text-right tabular-nums" : ""}`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.totalRows > s.rows.length && (
        <p className="mt-1 break-keep text-xs text-zinc-500">
          위쪽 {s.rows.length}줄만 보여요(이 파일은 {s.totalRows}줄).{moreHint && ` ${moreHint}`}
        </p>
      )}
    </>
  );
}

// 줄의 영수증을 화면 위 팝업으로(새 탭 아님). 같은 영수증이 이어지는 줄(위하고 두 줄)은 한 번만 거쳐 이전·다음으로 넘긴다. Esc·바깥 누르면 닫힘
function ReceiptModal({ sheet, row, onMove, onClose }: { sheet: PreviewSheet; row: number; onMove: (row: number) => void; onClose: () => void }) {
  const links = sheet.links ?? [];
  const stops = links.map((l, i) => (l && l !== links[i - 1] ? i : -1)).filter((i) => i >= 0);
  const at = stops.findIndex((i) => links[i] === links[row]);
  const url = links[row]!;
  const pdf = /\.pdf(\?|$)/i.test(url);
  const head = sheet.rows[0] ?? [];
  // 아래 줄 정보: 영수증과 맞춰 볼 칸(날짜·가맹점·계정과목·적요·금액)을 먼저, 없으면 앞쪽 칸
  const all = (sheet.rows[row] ?? []).map((v, k) => ({ h: head[k] ?? "", v })).filter((c) => c.v && c.h);
  const key = all.filter((c) => /일자|가맹점|거래처명|^거래처$|계정과목$|계정과목명|적요|합계|^금액$|차변|대변|사용자/.test(c.h));
  const cells = (key.length >= 3 ? key : all).slice(0, 7);
  const prev = at > 0 ? stops[at - 1] : null;
  const next = at >= 0 && at < stops.length - 1 ? stops[at + 1] : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prev !== null) onMove(prev);
      if (e.key === "ArrowRight" && next !== null) onMove(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onMove, onClose]);
  const nav = "inline-flex size-11 items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-30";
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white" role="dialog" aria-modal aria-label={`${row + 1}행 영수증`}>
      <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span className="min-w-0 flex-1 truncate text-sm">
          {sheet.sheet} · {row + 1}행{stops.length > 1 && at >= 0 ? ` (${at + 1}/${stops.length})` : ""}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs text-white/70 hover:bg-white/10" aria-label="새 창으로 열기">
          <ExternalLink className="size-4" aria-hidden />
          <span className="hidden sm:inline">새 창</span>
        </a>
        <button type="button" onClick={onClose} className={nav} aria-label="닫기">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {pdf ? (
          <iframe src={url} title={`${row + 1}행 영수증`} className="size-full max-w-3xl rounded-lg bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 서명 주소(10분) 원본을 그대로
          <img src={url} alt={`${row + 1}행 영수증`} className="max-h-full max-w-full rounded-lg object-contain" />
        )}
        <button type="button" disabled={prev === null} onClick={() => prev !== null && onMove(prev)} className={`${nav} absolute left-2 top-1/2 -translate-y-1/2 bg-black/40`} aria-label="이전 영수증">
          <ChevronLeft className="size-6" />
        </button>
        <button type="button" disabled={next === null} onClick={() => next !== null && onMove(next)} className={`${nav} absolute right-2 top-1/2 -translate-y-1/2 bg-black/40`} aria-label="다음 영수증">
          <ChevronRight className="size-6" />
        </button>
      </div>
      {cells.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 text-xs text-white/80">
          {cells.map((c, k) => (
            <div key={k} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-white/50">{c.h}</dt>
              <dd className="truncate">{c.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
