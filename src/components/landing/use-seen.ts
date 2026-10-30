"use client";

import { useEffect, useState, type RefObject } from "react";

// 랜딩 애니메이션 공통 기준(D-182): 사람이 실제로 보고 있을 때만 true.
// 요소가 충분히 보일 때(요소 높이의 60% — 화면보다 긴 요소는 화면 높이의 60%) 켜지고,
// 거의 사라졌을 때(15% 아래)나 다른 탭·앱으로 가 페이지가 가려졌을 때 꺼진다. 켜짐·꺼짐 기준을 달리 둬 조금 스크롤할 때 깜빡이지 않게 한다
const ENTER = 0.6;
const LEAVE = 0.15;
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export function useSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        const viewport = e.rootBounds?.height ?? window.innerHeight;
        const shown = e.intersectionRect.height / Math.max(1, Math.min(e.boundingClientRect.height, viewport));
        setInView((was) => (was ? shown > LEAVE : shown >= ENTER));
      },
      { threshold: THRESHOLDS },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return inView && pageVisible;
}
