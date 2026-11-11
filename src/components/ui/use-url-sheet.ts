"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// 화면 위 창(시트)을 주소 ?키=값으로 연다(D-257). 휴대폰 [뒤로]가 창만 닫고 화면에 머문다.
// history.pushState는 Next 라우터와 이어져 useSearchParams만 바뀌고 서버를 다시 부르지 않는다.
// depth = 이 화면에서 창 때문에 쌓은 기록 수. 주소로 바로 들어온 경우(0)에는 닫을 때 기록을 바꿔치기만 한다
export function useUrlSheet() {
  const sp = useSearchParams();
  const router = useRouter();
  const depth = useRef(0);
  useEffect(() => {
    const on = () => {
      depth.current = Math.max(0, depth.current - 1);
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  const href = (patch: Record<string, string | null>) => {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) u.searchParams.delete(k);
      else u.searchParams.set(k, v);
    }
    return u.pathname + u.search;
  };
  // 창 열기(한 겹 더)
  const open = (patch: Record<string, string | null>) => {
    window.history.pushState(null, "", href(patch));
    depth.current++;
  };
  // 한 겹만 닫기(창 안의 [← 돌아가기])
  const back = (patch: Record<string, string | null>) => {
    if (depth.current > 0) window.history.back();
    else window.history.replaceState(null, "", href(patch));
  };
  // 창을 모두 닫기
  const close = (keys: string[]) => {
    const d = depth.current;
    depth.current = 0;
    if (d > 0) window.history.go(-d);
    else window.history.replaceState(null, "", href(Object.fromEntries(keys.map((k) => [k, null]))));
  };
  // 보낸 뒤: 창 기록을 걷어 내고 결과 주소로(뒤로 가도 창이 다시 열리지 않게)
  const finish = (to: string) => {
    const d = depth.current;
    depth.current = 0;
    const go = () => {
      router.replace(to);
      router.refresh();
    };
    if (d === 0) return go();
    const once = () => {
      window.removeEventListener("popstate", once);
      go();
    };
    window.addEventListener("popstate", once);
    window.history.go(-d);
  };
  return { get: (k: string) => sp.get(k), open, back, close, finish };
}
