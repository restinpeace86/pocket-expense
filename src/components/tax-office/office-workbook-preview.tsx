import { FileSpreadsheet } from "lucide-react";
import { taxWorkbookLayout, taxWorkbookPreview } from "@/lib/tax/workbook";
import { WorkbookViewer } from "./default-workbook-info";

// 세무 자료 화면: [세무용 엑셀 다운로드] 전에 그 회사·그 달 실제 자료로 같은 파일을 만들어 엑셀 모양으로 미리보기(D-187)
export async function OfficeWorkbookPreview(props: Parameters<typeof taxWorkbookPreview>[0]) {
  const sheets = await taxWorkbookPreview(props, 20);
  const notes = new Map(taxWorkbookLayout().map((s) => [s.sheet, s.note]));
  return (
    <details className="group rounded-xl border border-zinc-200 bg-white shadow-sm" aria-label="세무용 엑셀 미리보기">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <FileSpreadsheet className="size-4 shrink-0 text-emerald-700" aria-hidden />
        <span className="whitespace-nowrap font-semibold">세무용 엑셀 미리보기</span>
        <span className="hidden break-keep text-xs text-zinc-500 sm:inline">받기 전에 시트별로 확인</span>
        <span className="ml-auto whitespace-nowrap text-sm text-brand-700 group-open:hidden">펼치기</span>
        <span className="ml-auto hidden whitespace-nowrap text-sm text-zinc-500 group-open:inline">접기</span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4">
        <p className="mt-3 break-keep text-xs text-zinc-500">
          [세무용 엑셀 다운로드]로 받을 파일을 이 달 자료로 똑같이 만들어 보여 드려요{props.preview ? "(회사 마감 전이라 파일 이름에 '_마감전'이 붙어요)" : ""}.
        </p>
        <WorkbookViewer sheets={sheets.map((s) => ({ ...s, note: notes.get(s.sheet) ?? "" }))} moreHint="전체는 [세무용 엑셀 다운로드]로 받아 주세요." />
      </div>
    </details>
  );
}
