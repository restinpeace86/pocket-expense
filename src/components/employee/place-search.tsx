"use client";

import { Building2, History, Loader2, MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/components/ui/page-shell";
import type { RoutePlaceInput } from "@/lib/employee/editor-types";

// 출발지·도착지 자동완성 (trip-expense.md §4.1). 글자를 치면 0.3초 뒤 서버(/api/places → Kakao Local)에 묻고 목록에서 고른다.
// 고른 장소만 저장한다(좌표가 있어야 거리 계산이 된다). 검색이 안 되면 목록이 비고, 화면은 거리 직접 입력으로 안내한다.
// D-258: quick = 한 번 누르면 고르는 장소([회사] = 설정의 회사 위치 + 내 지난 운행의 최근 장소). 검색은 그대로
export function PlaceSearch({
  label,
  value,
  onSelect,
  placeholder,
  suggestion,
  quick = [],
  disabled = false,
}: {
  label: string;
  value: RoutePlaceInput | null;
  onSelect: (p: RoutePlaceInput | null) => void;
  placeholder: string;
  suggestion?: string; // 예: 도착지 칸에 출장지를 먼저 넣어 검색
  quick?: (RoutePlaceInput & { company?: boolean })[];
  disabled?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [list, setList] = useState<RoutePlaceInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(term)}`);
        const j = (await res.json()) as { places?: RoutePlaceInput[] };
        if (my === seq.current) {
          setList(j.places ?? []);
          setSearched(true);
          setActive(-1);
        }
      } catch {
        if (my === seq.current) {
          setList([]);
          setSearched(true);
        }
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function choose(p: RoutePlaceInput) {
    onSelect(p);
    setQ("");
    setList([]);
    setSearched(false);
  }

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2">
          <MapPin className="size-4 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{value.name}</span>
            {value.address && <span className="block truncate text-xs text-zinc-500">{value.address}</span>}
          </span>
          {!disabled && (
            <button type="button" onClick={() => onSelect(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${label} 다시 고르기`}>
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const open = q.trim().length >= 2 && (list.length > 0 || searched);
  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          className={`${inputClass} pr-10`}
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) {
              setList([]);
              setSearched(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, list.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter" && active >= 0 && list[active]) {
              e.preventDefault();
              choose(list[active]);
            }
          }}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-400" />}
      </div>
      {quick.length > 0 && !q && !disabled && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label} 빠른 선택`} data-place-quick>
          {quick.map((p) => (
            <button
              key={`${p.name}-${p.lat}-${p.lng}`}
              type="button"
              onClick={() => choose(p)}
              title={p.address ?? undefined}
              className={`inline-flex h-9 max-w-full items-center gap-1 truncate rounded-full border px-3 text-[13px] ${p.company ? "border-brand-300 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
              data-place-chip={p.company ? "company" : p.name}
            >
              {p.company ? <Building2 className="size-3.5 shrink-0" aria-hidden /> : <History className="size-3.5 shrink-0 text-zinc-400" aria-hidden />}
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
      {suggestion && !q && (
        <button type="button" onClick={() => setQ(suggestion)} className="self-start text-sm text-brand-700 underline underline-offset-2">
          출장지 &ldquo;{suggestion}&rdquo;(으)로 찾기
        </button>
      )}
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
          {list.length === 0 ? (
            <li className="px-3 py-3 text-sm text-zinc-500">찾는 장소가 없어요. 다른 이름이나 주소로 찾아 보세요.</li>
          ) : (
            list.map((p, i) => (
              <li key={`${p.name}-${p.lat}-${p.lng}`} role="option" aria-selected={i === active}>
                <button type="button" onClick={() => choose(p)} className={`flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-1.5 text-left ${i === active ? "bg-brand-50" : "hover:bg-zinc-50"}`}>
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.address && p.address !== p.name && <span className="text-xs text-zinc-500">{p.address}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
