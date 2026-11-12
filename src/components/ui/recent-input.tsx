"use client";

import { History } from "lucide-react";
import { useId, useState } from "react";
import { matchRecent } from "@/lib/employee/recent";

// 내가 전에 쓴 값에서 고르는 글자 칸(9-12 ③, D-258). 비어 있으면 최근 값 칩, 치기 시작하면 글자가 들어간 값이 아래에 이어진다.
// 고르지 않고 새로 쳐도 그대로 저장된다(칩은 거들 뿐). onPick: 칩·목록에서 골랐을 때(예: 가맹점 → 사업자번호 채우기)
export function RecentInput({
  id,
  value,
  onChange,
  recent,
  pool = recent,
  onPick,
  className,
  placeholder,
  maxLength,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  recent: string[]; // 비었을 때 칩(최근 3~5개)
  pool?: string[]; // 치는 중 찾아볼 값(기본 = recent)
  onPick?: (v: string) => void;
  className: string;
  placeholder?: string;
  maxLength?: number;
  label: string; // 칩 묶음을 읽어 줄 이름(예: "거래처명")
}) {
  const listId = useId();
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = focus ? matchRecent(pool, value, 5) : [];
  const pick = (v: string) => {
    onChange(v);
    onPick?.(v);
    setActive(-1);
  };
  return (
    <>
      <input
        id={id}
        className={className}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        role={pool.length ? "combobox" : undefined}
        aria-expanded={pool.length ? matches.length > 0 : undefined}
        aria-controls={pool.length ? listId : undefined}
        aria-autocomplete={pool.length ? "list" : undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") setActive(-1);
        }}
        data-recent-input={id}
      />
      {matches.length > 0 && (
        <ul id={listId} role="listbox" aria-label={`${label} 최근 값`} className="-mt-0.5 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm" data-recent-list>
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === active}>
              {/* 누르는 동안 칸에서 포커스가 빠져 목록이 먼저 닫히지 않게 mousedown 기본 동작을 막는다 */}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${i === active ? "bg-brand-50" : "hover:bg-zinc-50"}`}>
                <History className="size-4 shrink-0 text-zinc-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{m}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!value && recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label} 최근에 쓴 값`} data-recent-chips={id}>
          <span className="text-xs text-zinc-500">최근</span>
          {recent.map((r) => (
            <button key={r} type="button" onClick={() => pick(r)} className="h-9 max-w-full truncate rounded-full border border-zinc-300 bg-white px-3 text-[13px] text-zinc-700 hover:bg-zinc-50">
              {r}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
