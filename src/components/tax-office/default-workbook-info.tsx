"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";

export type PreviewSheet = { sheet: string; note: string; rows: string[][]; totalRows: number };

// 엑셀 열 이름 A, B, …, Z, AA, AB …
const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

// 결산 양식 화면 맨 위: 지금 고객사에 나가는 양식(D-185 → D-186). 기본 세무용 엑셀을 예시 지출로 실제로 만들어 시트 그대로 보여 준다
export function DefaultWorkbookInfo({ sheets, officeTemplates }: { sheets: PreviewSheet[]; officeTemplates: string[] }) {
  const [tab, setTab] = useState(0);
  const s = sheets[tab];
  const width = Math.max(0, ...s.rows.map((r) => r.length));
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="지금 고객사에 나가는 양식">
      <h2 className="font-semibold">지금 고객사에 나가는 양식</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        {officeTemplates.length === 0
          ? "우리 사무소 양식이 아직 없어서, 고객사 자료는 아래 기본 세무용 엑셀로만 받아요. 아래에서 양식을 추가하면 고객사 [세무 자료] 화면에 그 양식으로 받는 버튼이 함께 생겨요."
          : `기본 세무용 엑셀과 함께 우리 사무소 양식 ${officeTemplates.length}개(${officeTemplates.join(", ")})로도 받을 수 있어요.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <FileSpreadsheet className="size-4 shrink-0 text-emerald-700" aria-hidden />
          기본 세무용 엑셀 미리보기
        </p>
        <p className="break-keep text-xs text-zinc-500">예시 지출 3건(법인카드 1건 · 사비 2건)으로 실제 파일을 만들어 그대로 보여 드려요. 고객사 [세무 자료] › [세무용 엑셀 다운로드]로 받는 파일과 같은 모양이에요.</p>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-zinc-200" role="tablist" aria-label="시트">
        {sheets.map((x, i) => (
          <button
            key={x.sheet}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`-mb-px min-h-10 shrink-0 whitespace-nowrap rounded-t-lg border px-3 text-sm ${
              i === tab ? "border-zinc-200 border-b-white bg-white font-semibold text-emerald-800" : "border-transparent text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {x.sheet}
          </button>
        ))}
      </div>
      <p className="mt-2 break-keep text-xs text-zinc-600">{s.note}</p>

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
                <th className="sticky left-0 z-10 border border-zinc-300 bg-zinc-100 px-2 py-1 text-right font-normal text-zinc-500">{i + 1}</th>
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
      {s.totalRows > s.rows.length && <p className="mt-1 text-xs text-zinc-500">위쪽 {s.rows.length}줄만 보여요(이 예시 파일은 {s.totalRows}줄).</p>}
    </section>
  );
}
