"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { anchorOf, cellAddress, coverMap, mergeAt, setCellText, type Sheet } from "@/lib/doc-convert/model";

const ROW_PX = 30;

export type CellLook = { className?: string; hint?: string; attrs?: Record<string, string> };
type TableOpts = {
  editable: boolean;
  // 칸 연결 화면처럼 고치지 않고 칸만 고를 때
  onPick?: (r: number, c: number) => void;
  picked?: { r: number; c: number } | null;
  look?: (r: number, c: number) => CellLook | undefined;
};

// 엑셀 같은 표(서류 → 엑셀 편집기 8-104 A, 회사 양식 레이아웃 8-104 B 공용)
// 칸을 누르고 바로 입력(숨은 입력창), Enter·Tab·화살표 이동, Alt+Enter 줄바꿈, Delete 지우기, Ctrl+Z 되돌리기
export function useSheetGrid({ sheet, editable, onChange, onUndo }: { sheet: Sheet; editable: boolean; onChange: (fn: (s: Sheet) => Sheet) => void; onUndo: () => void }) {
  const [rawSel, setSel] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const R = sheet.cells.length;
  const C = sheet.cols.length;
  const covered = useMemo(() => coverMap(sheet), [sheet]);
  // 행을 지워 고른 칸이 표 밖이 되면 가장 가까운 칸으로
  const sel = rawSel.r < R && rawSel.c < C ? rawSel : anchorOf(sheet, Math.min(rawSel.r, R - 1), Math.min(rawSel.c, C - 1));
  const cur = sheet.cells[sel.r]?.[sel.c] ?? { t: "" };

  const select = (r: number, c: number) => {
    const a = anchorOf(sheet, Math.max(0, Math.min(R - 1, r)), Math.max(0, Math.min(C - 1, c)));
    setSel(a);
    setEditing(false);
    setValue("");
  };
  useEffect(() => {
    if (editable) input.current?.focus({ preventScroll: true });
  }, [sel, editable]);

  const commit = () => {
    if (editing && value !== cur.t) onChange((s) => setCellText(s, sel.r, sel.c, value));
    setEditing(false);
    setValue("");
  };
  const move = (dr: number, dc: number) => {
    const g = mergeAt(sheet, sel.r, sel.c);
    const r = dr > 0 ? sel.r + (g?.rs ?? 1) : sel.r + dr;
    const c = dc > 0 ? sel.c + (g?.cs ?? 1) : sel.c + dc;
    select(r, c);
  };
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (!editing) onUndo();
      return;
    }
    if (editing) {
      if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        commit();
        move(1, 0);
      } else if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        setValue((v) => v + "\n");
      } else if (e.key === "Tab") {
        e.preventDefault();
        commit();
        move(0, e.shiftKey ? -1 : 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
        setValue("");
      }
      return;
    }
    const k = e.key;
    if (k === "ArrowDown") (e.preventDefault(), move(1, 0));
    else if (k === "ArrowUp") (e.preventDefault(), move(-1, 0));
    else if (k === "ArrowRight") (e.preventDefault(), move(0, 1));
    else if (k === "ArrowLeft") (e.preventDefault(), move(0, -1));
    else if (k === "Tab") (e.preventDefault(), move(0, e.shiftKey ? -1 : 1));
    else if (k === "Enter" || k === "F2") {
      e.preventDefault();
      setEditing(true);
      setValue(cur.t);
    } else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      if (cur.t) onChange((s) => setCellText(s, sel.r, sel.c, ""));
    }
  };

  const renderTable = ({ editable: ed, onPick, picked, look }: TableOpts): ReactNode => (
    <table className="w-full table-fixed border-collapse bg-white text-[13px] leading-snug text-zinc-900" style={{ minWidth: Math.max(480, C * 56) }} data-sheet-table>
      <colgroup>
        {ed && <col style={{ width: 34 }} />}
        {sheet.cols.map((w, i) => (
          <col key={i} style={{ width: `${w}%` }} />
        ))}
      </colgroup>
      {ed && (
        <thead>
          <tr>
            <th className="h-6 border border-zinc-200 bg-zinc-50" />
            {sheet.cols.map((_, c) => (
              <th key={c} className={`h-6 border border-zinc-200 text-[11px] font-medium ${c === sel.c ? "bg-brand-100 text-brand-900" : "bg-zinc-50 text-zinc-500"}`}>
                {cellAddress(0, c).replace(/\d+$/, "")}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {sheet.cells.map((row, r) => (
          <tr key={r} style={{ height: ROW_PX * (sheet.heights[r] ?? 1) }}>
            {ed && <th className={`border border-zinc-200 text-[11px] font-medium ${r === sel.r ? "bg-brand-100 text-brand-900" : "bg-zinc-50 text-zinc-500"}`}>{r + 1}</th>}
            {row.map((cell, c) => {
              if (covered.has(`${r}:${c}`)) return null;
              const g = mergeAt(sheet, r, c);
              const on = ed && sel.r === r && sel.c === c;
              const isPicked = !!picked && picked.r === r && picked.c === c;
              const lk = look?.(r, c);
              return (
                <td
                  key={c}
                  rowSpan={g?.rs}
                  colSpan={g?.cs}
                  onMouseDown={
                    ed && !on
                      ? (e) => {
                          e.preventDefault(); // 기본 동작(포커스를 body로)이 새 칸 입력창 포커스를 빼앗지 않게
                          commit();
                          select(r, c);
                        }
                      : onPick
                        ? (e) => {
                            e.preventDefault();
                            onPick(r, c);
                          }
                        : undefined
                  }
                  onDoubleClick={
                    ed
                      ? () => {
                          setEditing(true);
                          setValue(cell.t);
                        }
                      : undefined
                  }
                  className={`relative whitespace-pre-wrap break-words border border-zinc-700 px-1.5 py-1 align-middle ${cell.bg ? "bg-zinc-100" : ""} ${cell.b ? "font-bold" : ""} ${cell.al === "c" ? "text-center" : cell.al === "r" ? "text-right" : ""} ${on || isPicked ? "outline outline-2 -outline-offset-2 outline-brand-600" : ""} ${ed ? "cursor-cell" : onPick ? "cursor-pointer" : ""} ${lk?.className ?? ""}`}
                  data-cell={cellAddress(r, c)}
                  {...lk?.attrs}
                >
                  {cell.t}
                  {!cell.t && lk?.hint && <span className="text-[12px] text-zinc-500">{lk.hint}</span>}
                  {on && (
                    <textarea
                      ref={input}
                      value={editing ? value : ""}
                      onChange={(e) => {
                        if (!editing) setEditing(true);
                        setValue(e.target.value);
                      }}
                      onKeyDown={onKey}
                      onBlur={() => editing && commit()}
                      aria-label={`${cellAddress(r, c)} 칸 고치기`}
                      className={`absolute inset-0 z-10 h-full min-h-full w-full resize-none border-0 px-1.5 py-1 text-[13px] leading-snug outline outline-2 -outline-offset-2 outline-brand-600 ${editing ? "bg-white" : "bg-transparent text-transparent caret-transparent"}`}
                      data-cell-input
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return { sel, setSel, select, editing, value, cur, commit, renderTable, R, C };
}
