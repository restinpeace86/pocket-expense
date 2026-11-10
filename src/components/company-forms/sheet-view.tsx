"use client";

import { cellHint, type Field } from "@/lib/company-forms/model";
import type { Sheet } from "@/lib/doc-convert/model";
import { useSheetGrid, type CellLook } from "@/components/doc-convert/use-sheet-grid";

// 고치지 않는 표 보기(미리보기·칸 연결). 값 칸은 색과 {들어갈 데이터}로 표시
export function SheetView({ sheet, fields, s, look, onPick, picked }: { sheet: Sheet; fields?: Field[]; s?: number; look?: (r: number, c: number) => CellLook | undefined; onPick?: (r: number, c: number) => void; picked?: { r: number; c: number } | null }) {
  const g = useSheetGrid({ sheet, editable: false, onChange: () => {}, onUndo: () => {} });
  const byCell = new Map((fields ?? []).filter((f) => f.s === (s ?? 0)).map((f) => [`${f.r}:${f.c}`, f]));
  const defaultLook = (r: number, c: number): CellLook | undefined => {
    const f = byCell.get(`${r}:${c}`);
    if (!f) return undefined;
    return { className: f.b.k === "pending" ? "bg-amber-50" : "bg-emerald-50/70", hint: cellHint(f.b, f.label) };
  };
  return <>{g.renderTable({ editable: false, look: look ?? defaultLook, onPick, picked })}</>;
}
