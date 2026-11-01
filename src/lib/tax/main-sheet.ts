import { TARGET_LABEL, type TemplateColumn, type TemplateTarget } from "@/lib/tax-office/template-fields";

// 회계 프로그램 시트(D-189): 기본 = 더존 위하고 일반전표(법인카드는 고객사가 홈택스로 받지 않을 때만), 사무소가 결산 양식을 고르면 그 양식대로 채운 시트
export type MainSheet = { kind: "wehago"; includeCorporate: boolean } | { kind: "template"; name: string; target: TemplateTarget; columns: TemplateColumn[] };
export const WEHAGO_DEFAULT: MainSheet = { kind: "wehago", includeCorporate: false };
// 엑셀 시트 이름: 31자, [ ] : * ? / \ 는 쓸 수 없음
export function mainSheetName(main: MainSheet): string {
  if (main.kind === "wehago") return main.includeCorporate ? "위하고 일반전표(법인카드·사비)" : "위하고 일반전표(사비)";
  return main.name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "사무소 양식";
}
export function mainSheetNote(main: MainSheet): string {
  if (main.kind === "wehago")
    return main.includeCorporate
      ? "더존 위하고 일반전표 [엑셀올리기]용 — 지출 1건 = 차변(비용) + 대변(253 미지급금: 사비는 직원, 법인카드는 카드) 두 줄"
      : "더존 위하고 일반전표 [엑셀올리기]용 — 사비 지출 1건 = 차변(비용) + 대변(253 미지급금·직원) 두 줄. 법인카드는 홈택스로 받아 위하고에 넣고 계셔서 뺐어요";
  return `우리 사무소 결산 양식 [${main.name}]대로 채운 시트 — 넣은 지출: ${TARGET_LABEL[main.target]}`;
}

// 회계 프로그램 시트는 다섯 번째 시트(지출내역·요약·세무 업로드 2개 다음) — 미리보기는 이 시트부터 연다
export const MAIN_TAB = 4;
