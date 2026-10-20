"use client";

import { Check, ChevronDown, Palette } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { saveUiThemeAction } from "@/app/workspace/theme-actions";
import { DEFAULT_THEME, isThemeKey, THEME_STORAGE_KEY, THEMES, type ThemeKey } from "@/lib/theme";

// 화면 색상 고르기 (D-066). 고른 값은 계정에 저장되고(어느 기기에서나 같은 색), 이 브라우저에도 저장해
// 첫 화면을 그리기 전에 app/layout.tsx의 스크립트가 바로 적용한다(깜빡임 방지).
const EVENT = "pe-theme-change";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const current = (): ThemeKey => {
  const t = document.documentElement.dataset.theme;
  return isThemeKey(t) ? t : DEFAULT_THEME;
};
const useTheme = () => useSyncExternalStore(subscribe, current, () => DEFAULT_THEME);

function applyTheme(key: ThemeKey) {
  document.documentElement.setAttribute("data-theme", key);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, key);
  } catch {
    // 저장할 수 없으면 이번 화면에만 적용
  }
  window.dispatchEvent(new Event(EVENT));
}

function chooseTheme(key: ThemeKey) {
  applyTheme(key);
  // 저장에 실패해도 화면 색은 이미 바뀌었으므로 조용히 넘어간다(다음 선택 때 다시 저장)
  saveUiThemeAction(key).catch(() => {});
}

// 계정에 저장된 색과 이 브라우저의 색 맞추기:
// 계정 값이 있으면 그 색으로, 계정 값이 없고 이 브라우저에서 고른 적이 있으면 그 색을 계정에 올린다.
function useAccountThemeSync(saved: string | null | undefined) {
  useEffect(() => {
    if (isThemeKey(saved)) {
      if (current() !== saved) applyTheme(saved);
      return;
    }
    try {
      const local = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeKey(local)) saveUiThemeAction(local).catch(() => {});
    } catch {
      // 저장소를 쓸 수 없으면 기본 색
    }
  }, [saved]);
}

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
// 모바일 관리자 메뉴 안의 색상 선택 — 설정 메뉴처럼 기본은 접어 둔다
export function ThemeOptionsInline() {
  const theme = useTheme();
  const current = THEMES.find((t) => t.key === theme);
  return (
    <details className="group border-t border-sidebar-border px-3 pb-4 pt-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm text-sidebar-fg hover:bg-sidebar-hover [&::-webkit-details-marker]:hidden">
        <Palette className="size-5 shrink-0" />
        <span className="flex-1">화면 색상</span>
        {current && (
          <span className="flex items-center gap-1.5 text-xs text-sidebar-muted">
            <Swatch colors={current.swatch} />
            {current.label}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-1 flex flex-col gap-1 pl-3" role="radiogroup" aria-label="화면 색상">
        {THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={theme === t.key}
            onClick={() => chooseTheme(t.key)}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm ${theme === t.key ? "bg-sidebar-active font-semibold text-sidebar-active-fg" : "text-sidebar-fg hover:bg-sidebar-hover"}`}
          >
            <Swatch colors={t.swatch} />
            <span className="flex-1">{t.label}</span>
            {theme === t.key && <Check className="size-4 shrink-0" />}
          </button>
        ))}
      </div>
    </details>
  );
}

export function ThemeSwitcher({ saved }: { saved?: string | null }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  useAccountThemeSync(saved);

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
            className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <p className="px-2.5 pb-1 pt-1.5 text-xs text-zinc-500">화면 색상 (내 계정에 저장돼요)</p>
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="menuitemradio"
                aria-checked={theme === t.key}
                onClick={() => {
                  chooseTheme(t.key);
                  setOpen(false);
                }}
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
