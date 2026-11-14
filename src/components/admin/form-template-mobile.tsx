import { Monitor } from "lucide-react";

// 지출결의서 양식 — 휴대폰(md 미만)에서는 지금 쓰는 양식만 보여 주고, 바꾸기는 PC에서(D-278, 사용자 2026-11-14 "모바일 세팅 화면이 너무 복잡").
// 회사 양식(spec/features/company-forms.md §B)과 같은 원칙: 칸을 하나하나 다루는 설정은 큰 화면에서만
export function FormTemplateMobile({ activeName, version }: { activeName: string; version: number | null }) {
  return (
    <div className="flex flex-col gap-3 md:hidden" data-form-template-mobile>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
        <span className="text-zinc-600">지금 쓰는 양식</span>
        <span className="font-semibold text-zinc-900">
          {activeName}
          {version && <span className="ml-1 text-xs font-normal text-zinc-500">v{version}</span>}
        </span>
      </div>
      <section className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
        <Monitor className="size-7 text-brand-700" aria-hidden />
        <h2 className="text-base font-bold text-zinc-900">양식 바꾸기는 PC에서 해 주세요</h2>
        <p className="break-keep text-sm leading-relaxed text-zinc-700">
          칸 이름·순서를 하나하나 정하고 미리보기와 비교해야 해서 큰 화면이 필요해요. PC에서 <b>[설정 › 양식·결재 › 지출결의서 양식]</b>을 열어 주세요.
        </p>
        <p className="break-keep text-xs text-zinc-600">휴대폰에서도 결재·지출결의서 PDF 받기는 지금 양식 그대로 돼요.</p>
      </section>
    </div>
  );
}
