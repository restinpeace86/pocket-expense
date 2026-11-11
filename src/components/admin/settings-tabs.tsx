"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findSettingsTab } from "@/lib/admin/settings-groups";

// 설정 그룹 화면 위 탭(D-251): 그룹 이름 + 하위 영역 탭. 탭이 하나뿐인 그룹(기능 사용·파일 보관·요금제)은 그룹 이름만 없이 그대로
// 휴대폰은 탭이 옆으로 밀린다(줄 바꿈 없이, 화면 자체는 가로로 넘치지 않음)
export function SettingsTabs({ base, previewPath }: { base: string; previewPath?: string }) {
  const real = usePathname();
  const pathname = previewPath ? `${base}${previewPath}` : real;
  if (!pathname.startsWith(base)) return null;
  const hit = findSettingsTab(pathname.slice(base.length));
  if (!hit || hit.group.tabs.length < 2) return null;
  return (
    <div className="-mb-1 flex min-w-0 flex-col gap-1" data-settings-tabs={hit.group.key}>
      <p className="text-xs font-medium text-zinc-500">설정 · {hit.group.label}</p>
      <nav aria-label={`${hit.group.label} 하위 메뉴`} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
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
    </div>
  );
}
