import { FileSpreadsheet } from "lucide-react";
import { TARGET_LABEL, type TemplateTarget } from "@/lib/tax-office/template-fields";

export type TemplateLink = { id: string; name: string; target: TemplateTarget };

// 세무사무소 결산 양식으로 받기 버튼들 (D-150) — 세무사무소 세무 자료 화면·회사 세무 마감 화면 공용
export function TemplateDownloads({ templates, hrefFor, officeName, disabled }: { templates: TemplateLink[]; hrefFor: (id: string) => string; officeName?: string; disabled?: boolean }) {
  if (templates.length === 0) return null;
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" aria-label="세무사무소 결산 양식">
      <h2 className="font-semibold text-zinc-900">{officeName ? `${officeName} 결산 양식으로 받기` : "결산 양식으로 받기"}</h2>
      <p className="mt-0.5 break-keep text-sm text-zinc-600">세무사무소 회계 프로그램 양식에 이 달 승인된 지출을 채운 엑셀이에요.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {templates.map((t) => (
          <li key={t.id} className="min-w-0">
            <a
              href={hrefFor(t.id)}
              aria-disabled={disabled}
              className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border px-3 text-sm font-medium ${
                disabled ? "pointer-events-none border-zinc-200 bg-zinc-100 text-zinc-400" : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{t.name}</span>
              <span className="shrink-0 text-xs font-normal text-zinc-500">· {TARGET_LABEL[t.target]}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
