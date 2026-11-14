"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// 휴대폰 아래 고정 [무료로 시작하기](D-273): 첫 화면(히어로 버튼)을 지나면 나타나고, 맨 아래 끝 버튼이 보이면 숨긴다. PC(lg 이상)는 없음
export function MobileStartBar({ href }: { href: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => {
      const y = window.scrollY;
      const nearEnd = window.innerHeight + y > document.documentElement.scrollHeight - 700;
      setShow(y > window.innerHeight * 0.9 && !nearEnd);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur transition-transform duration-300 lg:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-full"}`}
      aria-hidden={!show}
      data-mobile-start={show ? "on" : "off"}
    >
      <Link
        href={href}
        tabIndex={show ? 0 : -1}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-600/25"
      >
        우리 회사 무료로 시작하기
      </Link>
      <p className="mt-1 text-center text-[11px] text-zinc-500">첫 월말 마감까지 무료 · 결제 정보 필요 없음</p>
    </div>
  );
}
