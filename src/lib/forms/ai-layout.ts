// AI가 종이 양식에서 읽은 결과 → 양식 틀 (D-118)
// AI는 칸 이름(label)과 "우리 데이터 중 무엇에 해당하는지(binding)"만 정한다. 해당 없으면 "none" → 채울 수 없는 칸으로 안내하고 뺀다.
// 결재란 칸 이름(담당·이사·대표 등)은 결재라인에서 자동으로 만들므로 칸으로 만들지 않는다(form-template.md §2).
import { COLUMN_CATALOG, FIELD_CATALOG, normalizeLayout, PRESETS, type ColumnKey, type FieldKey, type FormLayout, type LayoutField } from "./layout";

export type AiFormRead = {
  title?: string | null;
  approval_labels?: string[] | null;
  header_fields?: { label: string; binding: string }[] | null;
  table_columns?: { label: string; binding: string }[] | null;
  footer_fields?: { label: string; binding: string }[] | null;
  statement?: string | null;
  has_date?: boolean | null;
  signer_label?: string | null;
  has_company_line?: boolean | null;
};

export type AiLayoutResult = { layout: FormLayout; unmatched: string[]; approvalLabels: string[]; tableFallback: boolean };

const label = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 30) : "");

function pick<K extends string>(list: AiFormRead["header_fields"], catalog: Record<K, unknown>, unmatched: string[]): LayoutField<K>[] {
  const out: LayoutField<K>[] = [];
  for (const x of list ?? []) {
    const l = label(x?.label);
    if (x && typeof x.binding === "string" && x.binding in catalog && !out.some((o) => o.key === x.binding)) out.push({ key: x.binding as K, label: l });
    else if (l) unmatched.push(l);
  }
  return out;
}

export function layoutFromAi(raw: AiFormRead): AiLayoutResult {
  const unmatched: string[] = [];
  const header = pick<FieldKey>(raw.header_fields, FIELD_CATALOG, unmatched);
  let columns = pick<ColumnKey>(raw.table_columns, COLUMN_CATALOG, unmatched);
  const footer = pick<FieldKey>(raw.footer_fields, FIELD_CATALOG, unmatched).filter((f) => !header.some((h) => h.key === f.key));
  // 표 칸을 하나도 못 맞추면 영수증을 보여 줄 곳이 없으므로 기본 표(사용일·사용처·적요·금액)를 넣는다
  const tableFallback = !columns.length;
  if (tableFallback) columns = PRESETS.single.layout.columns;
  const layout = normalizeLayout({
    v: 1,
    base: "custom",
    title: label(raw.title) || "지출결의서",
    header,
    columns,
    totalLabel: "합계",
    footer,
    statement: typeof raw.statement === "string" ? raw.statement.replace(/\d{0,4}\s*년\s*\d{0,2}\s*월\s*\d{0,2}\s*일/g, "").trim() /* 날짜 줄은 따로(showDate) */ : null,
    showDate: raw.has_date === true,
    signerLabel: label(raw.signer_label).replace(/[:：_\s(]*(\(?인\)?)?$/, "") || null,
    showCompany: raw.has_company_line === true,
  });
  const approvalLabels = (raw.approval_labels ?? []).map(label).filter(Boolean).slice(0, 8);
  return { layout, unmatched: [...new Set(unmatched)], approvalLabels, tableFallback };
}

// Gemini에 줄 항목 설명(이 목록 밖으로는 짝짓지 못한다)
export function bindingGuide(): string {
  const f = Object.entries(FIELD_CATALOG).map(([k, v]) => `  - ${k}: ${v.label} — ${v.hint}`);
  const c = Object.entries(COLUMN_CATALOG).map(([k, v]) => `  - ${k}: ${v.label}${v.hint ? ` — ${v.hint}` : ""}`);
  return `헤더/표 아래 칸에 쓸 수 있는 항목:\n${f.join("\n")}\n표 열에 쓸 수 있는 항목:\n${c.join("\n")}`;
}
