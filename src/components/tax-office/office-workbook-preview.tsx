import { ChevronDown, FileSpreadsheet } from "lucide-react";
import { taxWorkbookLayout, taxWorkbookPreview } from "@/lib/tax/workbook";
import { signReceiptUrls } from "@/lib/storage/signed-urls";
import { createClient } from "@/lib/supabase/server";
import { MAIN_TAB, mainSheetName, WEHAGO_DEFAULT } from "@/lib/tax/main-sheet";
import { WorkbookViewer } from "./default-workbook-info";
import { ISSUE_LABEL, issueKinds, rowHasFile } from "@/lib/tax/export-rows";

// 세무 자료 화면: [세무용 엑셀 다운로드] 전에 그 회사·그 달 실제 자료로 같은 파일을 만들어 엑셀 모양으로 미리보기(D-187).
// 회사 세무 마감 화면에서도 같은 미리보기(D-190) — footer에 카드 대조 권유 등
// receiptUrls: 영수증 경로 → 서명 주소. 있으면 줄마다 돋보기로 그 줄의 영수증을 연다(D-193 — ZIP 안 증빙과 같은 사진)
export async function OfficeWorkbookPreview({
  footer,
  audience = "office",
  receiptUrls = {},
  ...props
}: Parameters<typeof taxWorkbookPreview>[0] & { footer?: React.ReactNode; audience?: "office" | "company"; receiptUrls?: Record<string, string> }) {
  const sheets = await taxWorkbookPreview(props, 20);
  const notes = new Map(taxWorkbookLayout(props.main, !!props.cardReconcile).map((s) => [s.sheet, s.note]));
  // 회사 화면: 미리보기에 보이는 줄의 영수증만 회사 권한으로 서명(페이지 나머지를 늦추지 않게 이 안에서)
  if (audience === "company") {
    const shown = new Set(sheets.flatMap((s) => s.items).filter((x): x is string => !!x));
    receiptUrls = Object.fromEntries(await signReceiptUrls(await createClient(), props.rows.filter((r) => shown.has(r.item_id)).map((r) => r.receipt_path)));
  }
  const urlByItem = new Map(props.rows.map((r) => [r.item_id, r.receipt_path ? (receiptUrls[r.receipt_path] ?? null) : null]));
  // 문제 있는 영수증의 줄은 ⚠·주황(D-195)
  const issueByItem = new Map(props.rows.map((r) => [r.item_id, issueKinds(r, rowHasFile(r)).map((k) => ISSUE_LABEL[k]).join(", ")]));
  const withLinks = sheets.map((s) => ({
    ...s,
    note: notes.get(s.sheet) ?? "",
    links: s.items.map((id) => (id ? (urlByItem.get(id) ?? null) : null)),
    flags: s.items.map((id) => (id ? issueByItem.get(id) || null : null)),
  }));
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
          sheets={withLinks}
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
