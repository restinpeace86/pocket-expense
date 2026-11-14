"use client";

import { useEffect, useState } from "react";

// 랜딩 상단 바로 가기(D-143 → D-270): 누른 곳·지금 보고 있는 구역을 표시(인디고 글자 + 밑줄, aria-current).
// 화면 가운데 줄에 걸린 구역을 지금 구역으로 본다. PC(lg 이상)에서만 보인다
export function SectionNav({ links }: { links: { href: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = links.map((l) => document.getElementById(l.href.slice(1))).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(`#${hit.target.id}`);
        else {
          // 메뉴에 없는 구역(한 달 흐름·누구에게)으로 넘어가면 표시를 끈다
          const left = entries.filter((e) => !e.isIntersecting).map((e) => `#${e.target.id}`);
          setActive((cur) => (cur && left.includes(cur) ? null : window.scrollY < 200 ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [links]);
  return (
    <>
      {links.map(({ href, label }) => {
        const on = active === href;
        return (
          <a
            key={href}
            href={href}
            onClick={() => setActive(href)}
            aria-current={on ? "location" : undefined}
            className={`relative hidden min-h-11 items-center whitespace-nowrap rounded-xl px-2.5 text-sm lg:inline-flex ${on ? "font-semibold text-indigo-700" : "text-zinc-600 hover:text-zinc-900"}`}
            data-section-link={href}
          >
            {label}
            <span aria-hidden className={`absolute inset-x-2.5 bottom-1.5 h-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
          </a>
        );
      })}
    </>
  );
}
