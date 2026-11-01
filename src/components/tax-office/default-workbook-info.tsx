import { FileSpreadsheet } from "lucide-react";
import type { WorkbookSheetInfo } from "@/lib/tax/workbook";

// 결산 양식 화면 맨 위: 지금 고객사에 나가는 양식(D-185). 기본 세무용 엑셀의 시트·칸 + 우리 사무소 양식 수
export function DefaultWorkbookInfo({ sheets, officeTemplates }: { sheets: WorkbookSheetInfo[]; officeTemplates: string[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="지금 고객사에 나가는 양식">
      <h2 className="font-semibold">지금 고객사에 나가는 양식</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        {officeTemplates.length === 0
          ? "우리 사무소 양식이 아직 없어서, 고객사 자료는 아래 기본 세무용 엑셀로만 받아요. 아래에서 양식을 추가하면 고객사 [세무 자료] 화면에 그 양식으로 받는 버튼이 함께 생겨요."
          : `기본 세무용 엑셀과 함께 우리 사무소 양식 ${officeTemplates.length}개(${officeTemplates.join(", ")})로도 받을 수 있어요.`}
      </p>
      <div className="mt-3 rounded-lg bg-zinc-50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <FileSpreadsheet className="size-4 shrink-0 text-emerald-700" aria-hidden />
          기본 세무용 엑셀 · 시트 {sheets.length}개
        </p>
        <p className="mt-0.5 break-keep text-xs text-zinc-500">고객사 [세무 자료] 화면의 [세무용 엑셀 다운로드]로 받는 파일이에요. 시트를 누르면 칸 이름이 보여요.</p>
        <ul className="mt-2 flex flex-col gap-1">
          {sheets.map((s) => (
            <li key={s.sheet}>
              <details className="group rounded-lg border border-zinc-200 bg-white">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="font-medium text-zinc-900">{s.sheet}</span>
                  <span className="break-keep text-xs text-zinc-500">{s.note}</span>
                  <span className="ml-auto text-xs text-zinc-400 group-open:hidden">{s.columns.length ? `칸 ${s.columns.length}개` : "표 아님"}</span>
                </summary>
                {s.columns.length > 0 && (
                  <ol className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-3 py-2">
                    {s.columns.map((c, i) => (
                      <li key={`${c}-${i}`} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        <span className="text-zinc-400">{i + 1}.</span> {c}
                      </li>
                    ))}
                  </ol>
                )}
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
