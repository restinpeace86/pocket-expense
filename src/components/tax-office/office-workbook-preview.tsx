import { ChevronDown, FileSpreadsheet } from "lucide-react";
import { taxWorkbookLayout, taxWorkbookPreview } from "@/lib/tax/workbook";
import { MAIN_TAB, mainSheetName, WEHAGO_DEFAULT } from "@/lib/tax/main-sheet";
import { WorkbookViewer } from "./default-workbook-info";

// 세무 자료 화면: [세무용 엑셀 다운로드] 전에 그 회사·그 달 실제 자료로 같은 파일을 만들어 엑셀 모양으로 미리보기(D-187).
// 회사 세무 마감 화면에서도 같은 미리보기(D-190) — footer에 카드 대조 권유 등
export async function OfficeWorkbookPreview({ footer, audience = "office", ...props }: Parameters<typeof taxWorkbookPreview>[0] & { footer?: React.ReactNode; audience?: "office" | "company" }) {
  const sheets = await taxWorkbookPreview(props, 20);
  const notes = new Map(taxWorkbookLayout(props.main, !!props.cardReconcile).map((s) => [s.sheet, s.note]));
  const [y, m] = props.month.split("-");
  return (
    // 접혀 있을 때도 눈에 띄게(D-188): 초록 테두리·배경 + 이 달·건수·시트 수 + [펼쳐 보기] 버튼 모양
    <details className="group rounded-xl border-2 border-emerald-300 bg-emerald-50/60 shadow-sm open:border-zinc-200 open:bg-white" aria-label="세무용 엑셀 미리보기">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <FileSpreadsheet className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-keep font-semibold text-zinc-900">
            {Number(y)}년 {Number(m)}월 세무용 엑셀 미리보기
          </span>
          <span className="block break-keep text-xs text-zinc-600">
            받기 전에 확인 · 지출 {props.rows.length}건 · 시트 {sheets.length}개
          </span>
        </span>
        <span className="inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white group-open:bg-zinc-100 group-open:font-medium group-open:text-zinc-600">
          <span className="group-open:hidden">펼쳐 보기</span>
          <span className="hidden group-open:inline">접기</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4">
        <p className="mt-3 break-keep text-xs text-zinc-500">
          {audience === "company"
            ? "세무사무소에 넘어갈 세무용 엑셀을 이 달 자료로 똑같이 만들어 보여 드려요."
            : `[세무용 엑셀 다운로드]로 받을 파일을 이 달 자료로 똑같이 만들어 보여 드려요${props.preview ? "(회사 마감 전이라 파일 이름에 '_마감전'이 붙어요)" : ""}.`}
        </p>
        <WorkbookViewer
          sheets={sheets.map((s) => ({ ...s, note: notes.get(s.sheet) ?? "" }))}
          moreHint={audience === "company" ? "전체는 [엑셀만 미리 받기]로 받아 보세요." : "전체는 [세무용 엑셀 다운로드]로 받아 주세요."}
          // 회사 화면은 지출내역부터, 회계 프로그램 시트에는 "세무사무소용" 표시(D-192). 세무사무소는 회계 프로그램 시트부터
          initialTab={audience === "company" ? 0 : MAIN_TAB}
          tabBadges={audience === "company" ? { [mainSheetName(props.main ?? WEHAGO_DEFAULT)]: "세무사무소용" } : {}}
        />
        {footer}
      </div>
    </details>
  );
}
