"use client";

import { useEffect } from "react";

// 휴대폰 가상 키보드 대응 (todo_improvement(2차) 8, D-101). 화면마다 넣지 않고 앱 전체에서 한 번:
// - 키보드가 올라오면(visualViewport가 120px 넘게 줄면) <html data-keyboard="open">, --kb = 키보드 높이.
//   CSS가 .kb-hide(하단 고정 바)를 숨기고 .kb-pad(긴 입력 화면)의 아래 여백을 키보드 높이만큼 늘린다(globals.css).
// - 글자 입력칸에 포커스하면 키보드가 다 올라온 뒤, 가려져 있으면 그 칸을 키보드 위 보이는 영역 가운데로 부드럽게 옮긴다.
const TEXT_INPUT = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range]), textarea, select, [contenteditable="true"]';

export function KeyboardAware() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        const open = kb > 120 && !!document.activeElement?.matches?.(TEXT_INPUT);
        if (open) {
          root.dataset.keyboard = "open";
          root.style.setProperty("--kb", `${kb}px`);
        } else if (root.dataset.keyboard) {
          delete root.dataset.keyboard;
          root.style.removeProperty("--kb");
        }
      });
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.matches?.(TEXT_INPUT)) return;
      // 터치 기기에서만(PC는 키보드가 화면을 가리지 않음). 키보드가 올라오는 시간을 기다린다
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.activeElement !== el) return;
        const r = el.getBoundingClientRect();
        const top = vv.offsetTop + 72; // 위쪽 머리글 여유
        const bottom = vv.offsetTop + vv.height - 24;
        if (r.top >= top && r.bottom <= bottom) return;
        // 보이는 영역(키보드 위) 가운데로. iOS는 키보드가 떠도 레이아웃 화면이 줄지 않아 scrollIntoView(center)로는 가려질 수 있다
        const want = vv.offsetTop + Math.max(72, (vv.height - r.height) / 2);
        window.scrollBy({ top: r.top - want, behavior: "smooth" });
      }, 320);
      update();
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return null;
}
