// 결재 문서 종류와 종류별 표준 칸(9-33d, D-279 · spec/features/company-forms.md §G-2)
// 회사가 결재 문서(품의서 등)를 등록하면 AI가 회사 양식의 빈칸을 이 표준 칸에 짝짓는다. 짝이 없는 칸은 '직원 입력'.
// 표준 칸은 입력 방식(금액·기간…)이 정해져 있어 [결재 문서] 쓰기 화면(3단계)에서 맞는 입력 칸으로 나오고, 나중에 목록·합계에 쓸 수 있다.
// 이름·부서·결재란 같은 공통 칸은 '우리 데이터'(COMMON_DATA)로 따로 채운다.
import type { InputType } from "./model";

export type StdField = { key: string; label: string; type: InputType; required: boolean; options?: string[] };
export type DocType = { code: DocTypeCode; label: string; keywords: string[]; fields: StdField[] };
export type DocTypeCode = "pumui" | "purchase" | "trip" | "outside" | "remote" | "early" | "incident" | "resign" | "absence" | "other";

const f = (key: string, label: string, type: InputType, required = false, options?: string[]): StdField => ({ key, label, type, required, ...(options ? { options } : {}) });

export const DOC_TYPES: DocType[] = [
  {
    code: "pumui",
    label: "품의서",
    keywords: ["품의", "기안"],
    fields: [f("title", "제목", "text", true), f("content", "품의 내용", "long", true), f("amount", "금액", "money"), f("period", "기간", "period"), f("vendor", "거래처", "text"), f("pay_method", "지급 방법", "choice", false, ["법인카드", "계좌이체", "현금", "기타"])],
  },
  {
    code: "purchase",
    label: "구매요청서",
    keywords: ["구매", "구입", "발주"],
    fields: [f("item", "품목", "text", true), f("spec", "규격", "text"), f("qty", "수량", "number"), f("unit_price", "단가", "money"), f("amount", "금액", "money", true), f("reason", "구매 사유", "long", true), f("due", "납기", "date"), f("vendor", "구매처", "text")],
  },
  {
    code: "trip",
    label: "출장신청서",
    keywords: ["출장"],
    fields: [f("place", "출장지", "text", true), f("period", "기간", "period", true), f("purpose", "목적", "long", true), f("companions", "동행자", "member"), f("budget", "예상 경비", "money"), f("transport", "교통수단", "choice", false, ["자가용", "회사 차량", "대중교통", "항공", "기타"])],
  },
  { code: "outside", label: "외근신청서", keywords: ["외근"], fields: [f("date", "날짜", "date", true), f("time", "시간", "time_range", true), f("place", "장소", "text", true), f("purpose", "목적", "long", true)] },
  { code: "remote", label: "재택근무 신청서", keywords: ["재택"], fields: [f("period", "기간", "period", true), f("reason", "사유", "long", true), f("work", "업무 내용", "long")] },
  { code: "early", label: "조퇴·외출 신청서", keywords: ["조퇴", "외출", "지각"], fields: [f("date", "날짜", "date", true), f("time", "시각", "time_range", true), f("reason", "사유", "long", true)] },
  { code: "incident", label: "시말서(경위서)", keywords: ["시말", "경위"], fields: [f("date", "발생일", "date", true), f("detail", "경위", "long", true), f("cause", "원인", "long"), f("prevent", "재발 방지 대책", "long")] },
  { code: "resign", label: "사직서", keywords: ["사직", "퇴직"], fields: [f("last_day", "퇴직 희망일", "date", true), f("reason", "사유", "long")] },
  {
    code: "absence",
    label: "휴직·복직원",
    keywords: ["휴직", "복직"],
    fields: [f("kind", "종류", "choice", true, ["육아휴직", "질병휴직", "개인휴직", "복직"]), f("period", "기간", "period", true), f("reason", "사유", "long")],
  },
  { code: "other", label: "기타", keywords: [], fields: [] },
];

export const DOC_TYPE_CODES = DOC_TYPES.map((d) => d.code);
export const isDocType = (x: unknown): x is DocTypeCode => typeof x === "string" && (DOC_TYPE_CODES as string[]).includes(x);
export const docTypeOf = (code: string | null | undefined): DocType => DOC_TYPES.find((d) => d.code === code) ?? DOC_TYPES[DOC_TYPES.length - 1];
export const docTypeLabel = (code: string | null | undefined) => docTypeOf(code).label;
// AI에 주는 표준 칸 키: "종류.칸"(예: pumui.amount)
export const stdKey = (code: DocTypeCode, key: string) => `${code}.${key}`;
export const ALL_STD_KEYS: string[] = DOC_TYPES.flatMap((d) => d.fields.map((x) => stdKey(d.code, x.key)));
export function stdField(code: string | null | undefined, key: string | undefined): StdField | null {
  if (!key) return null;
  return docTypeOf(code).fields.find((x) => x.key === key) ?? null;
}
// 제목으로 종류 짐작(AI가 못 골랐을 때): "품 의 서" → 품의서
export function guessDocType(title: string | null | undefined): DocTypeCode {
  const t = (title ?? "").replace(/\s+/g, "");
  return DOC_TYPES.find((d) => d.keywords.some((k) => t.includes(k)))?.code ?? "other";
}
// 짝 없는 칸의 입력 방식 짐작(관리자가 바꿀 수 있음)
export function guessInputType(label: string): InputType {
  const t = label.replace(/\s+/g, "");
  if (/(금액|비용|단가|경비|원\)?$|합계)/.test(t)) return "money";
  if (/(기간|부터|까지)/.test(t)) return "period";
  if (/(일자|날짜|일시|일$|년월일)/.test(t)) return "date";
  if (/(수량|개수|인원|매수)/.test(t)) return "number";
  if (/(내용|사유|목적|경위|설명|비고|의견)/.test(t)) return "long";
  return "text";
}
