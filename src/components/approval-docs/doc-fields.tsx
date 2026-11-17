"use client";

import type { Field } from "@/lib/company-forms/model";
import { stdField } from "@/lib/company-forms/doc-types";
import type { Payload } from "@/lib/approval-docs/model";
import { MAX_TABLE_INPUT_ROWS, tableCellText, tableTotal, type TableCol } from "@/lib/company-forms/table";

// [결재 문서] 쓰기 칸(9-33e3): 양식의 '직원 입력' 칸만 위→아래, 입력 방식마다 맞는 칸
// 저장 값: 글·날짜 = 그대로 / 금액·숫자 = 숫자만 / 기간 = "시작~끝"(날짜) / 시각 = "09:00~11:00" / 직원 고르기 = 이름
// 9-33e7: 체크 = "Y" 또는 "" / 표 = 줄들(열 순서, 빈 줄은 저장 때 뺌) / 첨부 = 붙인 파일 이름들(쓰기 화면이 넣음)
const box = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export function DocFields({ docType, fields, values, onChange, members, invalid, files = [] }: { docType: string; fields: Field[]; values: Payload; onChange: (key: string, v: string | string[][]) => void; members: { id: string; name: string }[]; invalid: string | null; files?: string[] }) {
  return (
    <div className="flex flex-col gap-4" data-doc-fields>
      {fields.map((f) => {
        if (f.b.k !== "input") return null;
        const b = f.b;
        const id = `doc-${f.key}`;
        const raw = values[f.key];
        const v = typeof raw === "string" ? raw : "";
        // 회사 양식에 적힌 이름 그대로(쓰던 양식 그대로). 비었으면 표준 칸 이름
        const label = f.label.trim() || stdField(docType, b.std)?.label || "입력";
        const bad = invalid === f.key;
        const cls = `${box} ${bad ? "border-red-500 ring-2 ring-red-500/20" : ""}`;
        const [a, z] = v.includes("~") ? v.split("~") : [v, ""];
        return (
          <div key={f.key} className="flex flex-col gap-1.5" data-doc-field={f.key} data-type={b.type}>
            <label htmlFor={id} className="text-sm font-medium">
              {label}
              {b.required ? <span className="ml-0.5 text-red-600">*</span> : <span className="ml-1 text-xs font-normal text-zinc-500">(선택)</span>}
            </label>
            {b.type === "check" ? (
              <label className={`flex min-h-12 items-center gap-3 rounded-xl border bg-white px-3.5 text-[15px] ${bad ? "border-red-500" : "border-zinc-300"}`}>
                <input id={id} type="checkbox" checked={v === "Y"} onChange={(e) => onChange(f.key, e.target.checked ? "Y" : "")} className="size-5 shrink-0 accent-brand-600" />
                <span>{label}</span>
              </label>
            ) : b.type === "attach" ? (
              <p id={id} className={`rounded-xl border px-3.5 py-2.5 text-[13px] ${bad ? "border-red-500 bg-red-50 text-red-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"}`}>
                {files.length ? <>아래 [첨부]에 붙인 파일 이름이 이 칸에 들어가요: <b>{files.join(", ")}</b></> : "아래 [첨부]에 파일을 붙이면 파일 이름이 이 칸에 들어가요."}
              </p>
            ) : b.type === "table" ? (
              <TableInput id={id} cols={b.cols ?? []} formRows={b.rows ?? 0} rows={Array.isArray(raw) ? (raw as string[][]) : []} onChange={(rows) => onChange(f.key, rows)} bad={bad} />
            ) : b.type === "long" ? (
              <textarea id={id} rows={4} maxLength={3000} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={`${cls} h-auto py-2.5`} />
            ) : b.type === "money" || b.type === "number" ? (
              <div className="relative">
                <input
                  id={id}
                  inputMode="numeric"
                  value={b.type === "money" && v ? Number(v).toLocaleString("ko-KR") : v}
                  onChange={(e) => onChange(f.key, e.target.value.replace(/[^0-9]/g, "").slice(0, 13))}
                  className={`${cls} ${b.type === "money" ? "pr-9 text-right" : ""}`}
                />
                {b.type === "money" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">원</span>}
              </div>
            ) : b.type === "date" ? (
              <input id={id} type="date" value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls} />
            ) : b.type === "period" || b.type === "time_range" ? (
              <div className="flex items-center gap-2">
                <input id={id} type={b.type === "period" ? "date" : "time"} aria-label={`${label} 시작`} value={a} onChange={(e) => onChange(f.key, `${e.target.value}~${z}`)} className={`${cls} min-w-0 flex-1`} />
                <span className="text-zinc-500">~</span>
                <input type={b.type === "period" ? "date" : "time"} aria-label={`${label} 끝`} value={z} min={b.type === "period" ? a || undefined : undefined} onChange={(e) => onChange(f.key, `${a}~${e.target.value}`)} className={`${cls} min-w-0 flex-1`} />
              </div>
            ) : b.type === "choice" && (b.options ?? []).length > 0 && (b.options ?? []).length <= 6 ? (
              <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2" id={id}>
                {(b.options ?? []).map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={v === o} onClick={() => onChange(f.key, v === o ? "" : o)} className={`h-10 rounded-xl border px-3.5 text-sm ${v === o ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-800"}`}>
                    {o}
                  </button>
                ))}
              </div>
            ) : b.type === "choice" || b.type === "member" ? (
              <select id={id} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls}>
                <option value="">{b.type === "member" ? "직원 고르기" : "고르기"}</option>
                {(b.type === "member" ? members.map((m) => m.name) : (b.options ?? [])).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} maxLength={300} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls} />
            )}
            {bad && (
              <span role="alert" className="text-[13px] font-semibold text-red-700">
                꼭 적어 주세요
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 표(줄 추가): 휴대폰에서는 줄마다 카드, 넓은 화면에서는 표. 금액 열이 있으면 합계
function TableInput({ id, cols, formRows, rows, onChange, bad }: { id: string; cols: TableCol[]; formRows: number; rows: string[][]; onChange: (rows: string[][]) => void; bad: boolean }) {
  const list = rows.length ? rows : [cols.map(() => "")];
  const set = (y: number, i: number, v: string) => onChange(list.map((row, yy) => (yy === y ? cols.map((_, ii) => (ii === i ? v : (row[ii] ?? ""))) : row)));
  const total = tableTotal(cols, list);
  const moneyAt = cols.map((k) => k.type).lastIndexOf("money");
  const cell = "h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 text-[15px] outline-none focus:border-brand-600";
  return (
    <div id={id} className={`flex flex-col gap-2 rounded-xl border p-2.5 ${bad ? "border-red-500 bg-red-50/40" : "border-zinc-200 bg-zinc-50"}`} data-table-input>
      {list.map((row, y) => (
        <div key={y} className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 shadow-sm md:flex-row md:items-end md:p-2" data-table-row={y}>
          <span className="text-xs font-semibold text-zinc-500 md:w-6 md:pb-3 md:text-center">{y + 1}</span>
          <div className="grid flex-1 grid-cols-2 gap-1.5 md:flex md:gap-1.5">
            {cols.map((k, i) => (
              <label key={k.c} className={`flex flex-col gap-0.5 ${i === 0 ? "col-span-2 md:flex-[2]" : "md:flex-1"}`}>
                <span className="text-[11.5px] text-zinc-600">{k.label}</span>
                <input
                  value={k.type === "money" && row[i] ? tableCellText("money", row[i]) : (row[i] ?? "")}
                  inputMode={k.type === "text" ? undefined : "numeric"}
                  maxLength={k.type === "text" ? 100 : 15}
                  onChange={(e) => set(y, i, k.type === "text" ? e.target.value : e.target.value.replace(/[^0-9]/g, ""))}
                  className={`${cell} ${k.type !== "text" ? "text-right" : ""}`}
                  aria-label={`${y + 1}번째 줄 ${k.label}`}
                />
              </label>
            ))}
          </div>
          {list.length > 1 && (
            <button type="button" onClick={() => onChange(list.filter((_, yy) => yy !== y))} className="h-9 self-end rounded-lg px-2 text-[13px] text-zinc-500 hover:bg-zinc-100" aria-label={`${y + 1}번째 줄 지우기`}>
              지우기
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 px-1">
        {list.length < MAX_TABLE_INPUT_ROWS && (
          <button type="button" onClick={() => onChange([...list, cols.map(() => "")])} className="h-10 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" data-table-add>
            + 줄 추가
          </button>
        )}
        {moneyAt >= 0 && total !== null && (
          <span className="text-sm text-zinc-700" data-table-total>
            {cols[moneyAt].label} 합계 <b>{total.toLocaleString("ko-KR")}원</b>
          </span>
        )}
      </div>
      {list.length > formRows && formRows > 0 && <p className="px-1 text-[12px] text-zinc-500">회사 양식 줄({formRows}줄)보다 많으면 문서에 줄을 더 넣어 모두 적어요.</p>}
    </div>
  );
}
