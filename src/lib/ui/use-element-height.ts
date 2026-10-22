"use client";

import { useEffect, useRef, useState } from "react";

// 고정 하단 바처럼 높이가 바뀌는 요소의 높이를 따라간다(안내 문구·업로드 진행이 생기면 커진다).
// 화면 아래 여백을 이 높이만큼 주면 맨 아래 버튼이 바에 가려지지 않는다.
export function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  return { ref, height };
}
