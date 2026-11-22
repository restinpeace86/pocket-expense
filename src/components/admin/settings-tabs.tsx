"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { findSettingsTab } from "@/lib/admin/settings-groups";

// 설정 그룹 화면 위 탭(D-251): 그룹 이름 + 하위 영역 탭. 탭이 하나뿐인 그룹(기능 사용·파일 보관·요금제)은 그룹 이름만 없이 그대로
// 휴대폰은 탭이 옆으로 밀린다(줄 바꿈 없이, 화면 자체는 가로로 넘치지 않음)
// U-5(D-307): 잘린 쪽 끝을 흐리게 + 오른쪽에 더 있으면 › 표시, 지금 탭이 보이게 옆으로 맞춤
export function SettingsTabs({ base, previewPath }: { base: string; previewPath?: string }) {
  const real = usePathname();
  const pathname = previewPath ? `${base}${previewPath}` : real;
  const hit = pathname.startsWith(base) ? findSettingsTab(pathname.slice(base.length)) : null;
  const show = !!hit && hit.group.tabs.length >= 2;
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const cur = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (cur && (cur.offsetLeft < el.scrollLeft || cur.offsetLeft + cur.offsetWidth > el.scrollLeft + el.clientWidth)) el.scrollLeft = cur.offsetLeft - 16;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [pathname, show]);

  if (!show || !hit) return null;
  return (
    <div className="-mb-1 flex min-w-0 flex-col gap-1" data-settings-tabs={hit.group.key}>
      <p className="text-xs font-medium text-zinc-500">설정 · {hit.group.label}</p>
      <div className="relative -mx-4 md:mx-0">
        <nav ref={ref} aria-label={`${hit.group.label} 하위 메뉴`} className="overflow-x-auto px-4 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden">
          <ul className="flex min-w-max gap-1 border-b border-zinc-200">
            {hit.group.tabs.map((t) => {
              const on = t.href === hit.tab.href;
              return (
                <li key={t.href}>
                  <Link
                    href={`${base}${t.href}`}
                    aria-current={on ? "page" : undefined}
                    className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm ${on ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900"}`}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {edge.left && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-page to-transparent" />}
        {edge.right && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-page via-page/90 to-transparent pr-1 text-zinc-500" data-tabs-more>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
