"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { saveChatThemeAction } from "@/app/workspace/theme-actions";
import { CHAT_THEME_STORAGE_KEY, CHAT_THEMES, DEFAULT_CHAT_THEME, isChatThemeKey, type ChatThemeKey } from "@/lib/chat/theme";

// 채팅 색감(D-211): 화면 색상(D-066)처럼 계정에 저장(어느 기기에서나 같은 색) + 이 브라우저에도 저장해
// 첫 화면을 그리기 전에 app/layout.tsx 스크립트가 바로 적용한다(깜빡임 방지). 고르는 곳: [내 정보] 카드, 채팅 목록 위 팔레트
const EVENT = "pe-chat-theme-change";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const current = (): ChatThemeKey => {
  const t = document.documentElement.dataset.chatTheme;
  return isChatThemeKey(t) ? t : DEFAULT_CHAT_THEME;
};
export const useChatTheme = () => useSyncExternalStore(subscribe, current, () => DEFAULT_CHAT_THEME);

function applyChatTheme(key: ChatThemeKey) {
  document.documentElement.setAttribute("data-chat-theme", key);
  try {
    window.localStorage.setItem(CHAT_THEME_STORAGE_KEY, key);
  } catch {
    // 저장할 수 없으면 이번 화면에만
  }
  window.dispatchEvent(new Event(EVENT));
}

function chooseChatTheme(key: ChatThemeKey) {
  applyChatTheme(key);
  saveChatThemeAction(key).catch(() => {});
}

// 계정 값과 이 브라우저 맞추기(계정 값 우선, 계정에 없고 이 브라우저에서 고른 적 있으면 계정에 올림)
export function ChatThemeSync({ saved }: { saved?: string | null }) {
  useEffect(() => {
    if (isChatThemeKey(saved)) {
      if (current() !== saved) applyChatTheme(saved);
      return;
    }
    try {
      const local = window.localStorage.getItem(CHAT_THEME_STORAGE_KEY);
      if (isChatThemeKey(local) && local !== DEFAULT_CHAT_THEME) saveChatThemeAction(local).catch(() => {});
    } catch {
      // 기본 색
    }
  }, [saved]);
  return null;
}

// 미리보기 말풍선 두 개(상대·나)
function Preview({ k }: { k: ChatThemeKey }) {
  const t = CHAT_THEMES.find((x) => x.key === k)!;
  const mine =
    k === "basic"
      ? { background: "#fee500", color: "#18181b", border: "1px solid transparent" }
      : k === "line"
        ? { background: "#ffffff", color: "#1e3a8a", border: "1px solid #1e3a8a" }
        : { background: "#dbe7f6", color: "#172554", border: "1px solid #bfd2ec" };
  const other = k === "basic" ? { background: "#fff", border: "1px solid transparent" } : k === "line" ? { background: "#f4f4f5", border: "1px solid #e4e4e7" } : { background: "#fff", border: "1px solid #dde3ec" };
  return (
    <span aria-hidden className="flex w-16 shrink-0 flex-col gap-1 rounded-lg p-1.5" style={{ background: t.swatch[0] }}>
      <span className="block h-2.5 w-9 rounded-full" style={other} />
      <span className="block h-2.5 w-9 self-end rounded-full" style={mine} />
    </span>
  );
}

function Options({ onPick }: { onPick?: () => void }) {
  const theme = useChatTheme();
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="채팅 색감">
      {CHAT_THEMES.map((t) => {
        const on = theme === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              chooseChatTheme(t.key);
              onPick?.();
            }}
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-1.5 text-left text-sm ${on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
          >
            <Preview k={t.key} />
            <span className="min-w-0 flex-1">
              <span className={`block ${on ? "font-semibold text-brand-700" : "font-medium text-zinc-900"}`}>{t.label}</span>
              <span className="block text-xs text-zinc-500">{t.hint}</span>
            </span>
            {on && <Check className="size-4 shrink-0 text-brand-600" />}
          </button>
        );
      })}
    </div>
  );
}

// [내 정보] 카드
export function ChatThemeCard() {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4" aria-labelledby="chat-theme-title">
      <div>
        <h2 id="chat-theme-title" className="font-semibold">
          채팅 색감
        </h2>
        <p className="mt-0.5 text-sm text-zinc-600">카카오톡과 헷갈리지 않게 업무형 색으로 바꿀 수 있어요. 내 계정에만 적용돼요.</p>
      </div>
      <Options />
    </section>
  );
}

// 채팅 목록 위 팔레트 버튼(관리자도 여기서 고른다)
export function ChatThemeButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="채팅 색감"
        className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-zinc-100"
      >
        <Palette className="size-5" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="닫기" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="채팅 색감"
            className="absolute right-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <p className="pb-2 text-xs text-zinc-500">채팅 색감 (내 계정에 저장돼요)</p>
            <Options onPick={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
