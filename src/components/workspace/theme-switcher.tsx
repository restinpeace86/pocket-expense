"use client";

import { Check, Palette } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

// 화면 색상 고르기 (D-066). 고른 값은 이 브라우저에만 저장되고, 첫 화면을 그리기 전에 app/layout.tsx의 스크립트가 적용한다.
export const THEME_STORAGE_KEY = "pe-theme";
const THEMES = [
  { key: "navy", label: "A · 딥 네이비", hint: "기본", swatch: ["#0f172a", "#4f46e5"] },
  { key: "light", label: "B · 화이트", hint: "밝고 깔끔하게", swatch: ["#f7f7f9", "#4f46e5"] },
  { key: "emerald", label: "C · 차콜·에메랄드", hint: "차분하게", swatch: ["#1c1f24", "#059669"] },
] as const;
type ThemeKey = (typeof THEMES)[number]["key"];
const EVENT = "pe-theme-change";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const current = (): ThemeKey => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "emerald" ? t : "navy";
};

function applyTheme(key: ThemeKey) {
  document.documentElement.setAttribute("data-theme", key);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, key);
  } catch {
    // 저장할 수 없으면 이번 화면에만 적용
  }
  window.dispatchEvent(new Event(EVENT));
}

const useTheme = () => useSyncExternalStore(subscribe, current, () => "navy" as ThemeKey);

function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-md border border-black/10">
      {colors.map((c) => (
        <span key={c} className="block size-4" style={{ background: c }} />
      ))}
    </span>
  );
}

// 모바일 관리자 메뉴(사이드바 색) 안에 펼쳐 두는 선택지. 헤더 공간이 좁은 모바일용.
export function ThemeOptionsInline() {
  const theme = useTheme();
  return (
    <div className="border-t border-sidebar-border px-3 pb-4 pt-3">
      <p className="px-3 pb-1 text-xs text-sidebar-muted">화면 색상</p>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="화면 색상">
        {THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={theme === t.key}
            onClick={() => applyTheme(t.key)}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm ${theme === t.key ? "bg-sidebar-active font-semibold text-sidebar-active-fg" : "text-sidebar-fg hover:bg-sidebar-hover"}`}
          >
            <Swatch colors={t.swatch} />
            <span className="flex-1">{t.label}</span>
            {theme === t.key && <Check className="size-4 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThemeSwitcher() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  function choose(key: ThemeKey) {
    applyTheme(key);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="화면 색상"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm text-zinc-600 hover:bg-zinc-100 sm:px-3"
      >
        <Palette className="size-4" />
        <span className="hidden sm:inline">색상</span>
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="닫기" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="화면 색상"
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <p className="px-2.5 pb-1 pt-1.5 text-xs text-zinc-500">화면 색상 (이 브라우저에 저장돼요)</p>
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="menuitemradio"
                aria-checked={theme === t.key}
                onClick={() => choose(t.key)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-50"
              >
                <Swatch colors={t.swatch} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-zinc-900">{t.label}</span>
                  <span className="block text-xs text-zinc-500">{t.hint}</span>
                </span>
                {theme === t.key && <Check className="size-4 shrink-0 text-brand-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
