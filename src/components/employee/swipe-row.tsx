"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

// 밀어서 삭제 (todo_improvement [개선사항 1]): 카드를 왼쪽으로 밀면 오른쪽에 [삭제]가 나온다.
// 손가락(터치)만 반응하고, 세로 스크롤은 그대로 된다(touch-action: pan-y). 열린 상태에서 카드를 누르면 닫힌다(이동하지 않음).
// PC(마우스)는 밀 수 없으니 카드 위에 올리면 작은 [삭제] 버튼이 보인다.
const OPEN = 88; // 열렸을 때 카드가 밀려 있는 너비(px) = [삭제] 버튼 너비

export function SwipeRow({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  const open = x <= -OPEN / 2;

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onDelete}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-red-600 font-semibold text-white"
        style={{ width: OPEN, visibility: x < 0 ? "visible" : "hidden" }}
      >
        <Trash2 className="size-4" /> 삭제
      </button>
      <div
        className="relative touch-pan-y"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 180ms ease-out" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          start.current = { x: e.clientX, y: e.clientY, base: x, axis: null };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.axis && Math.abs(dx) + Math.abs(dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (s.axis !== "x") return;
          setDragging(true);
          setX(Math.max(-OPEN - 24, Math.min(0, s.base + dx)));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          setDragging(false);
          if (s?.axis === "x") setX((v) => (v < -OPEN / 2 ? -OPEN : 0));
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setX((v) => (v < -OPEN / 2 ? -OPEN : 0));
        }}
        onClickCapture={(e) => {
          // 밀다가 손을 뗀 경우나 열린 상태에서 누르면 카드로 이동하지 않고 닫는다
          if (x !== 0) {
            e.preventDefault();
            e.stopPropagation();
            setX(0);
          }
        }}
      >
        {children}
      </div>
      {/* PC: 마우스를 올리면 작은 삭제 버튼 */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`${label} 삭제`}
        className="absolute right-2 top-2 hidden size-9 items-center justify-center rounded-lg bg-white/90 text-zinc-500 shadow-sm hover:text-red-600 [@media(hover:hover)]:group-hover:flex"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
