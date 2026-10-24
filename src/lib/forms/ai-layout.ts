// AI가 종이 양식에서 읽은 결과 → 양식 틀 (D-118, D-120)
// AI는 칸 이름(label)과 "우리 데이터 중 무엇에 해당하는지(binding)"만 정한다.
// 해당 없음("none")·같은 데이터 중복 칸은 버리지 않고 제자리에 "회사 추가 칸(아직 안 정함)"으로 둔다 →
// 관리자가 칸마다 [직원 작성] / [고정값] / [빈칸으로 남기기] / [빼기]를 정해야 저장된다(직원 품이 몰래 늘지 않게).
// 결재란 칸 이름(담당·이사·대표 등)은 결재라인에서 자동으로 만들므로 칸으로 만들지 않는다(form-template.md §2).
import { COLUMN_CATALOG, FIELD_CATALOG, newCustomKey, normalizeLayout, PRESETS, type CustomField, type FormLayout, type LayoutField } from "./layout";

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

export type AiLayoutResult = { layout: FormLayout; pending: string[]; approvalLabels: string[]; tableFallback: boolean };

const label = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 30) : "");

function pick<K extends string>(list: AiFormRead["header_fields"], catalog: Record<K, unknown>, taken: Set<string>): (LayoutField<K> | CustomField)[] {
  const out: (LayoutField<K> | CustomField)[] = [];
  for (const x of list ?? []) {
    const l = label(x?.label);
    if (x && typeof x.binding === "string" && x.binding in catalog && !taken.has(x.binding)) {
      taken.add(x.binding);
      out.push({ key: x.binding as K, label: l });
    } else if (l) out.push({ key: newCustomKey(), label: l, mode: "blank", pending: true });
  }
  return out;
}

export function layoutFromAi(raw: AiFormRead): AiLayoutResult {
  const takenFields = new Set<string>();
  const header = pick(raw.header_fields, FIELD_CATALOG, takenFields);
  const footer = pick(raw.footer_fields, FIELD_CATALOG, takenFields);
  let columns = pick(raw.table_columns, COLUMN_CATALOG, new Set());
  // 영수증 표 칸을 하나도 못 맞추면 영수증을 보여 줄 곳이 없으므로 기본 표(사용일·사용처·적요·금액)를 넣는다
  const tableFallback = !columns.some((c) => !c.key.startsWith("custom."));
  if (tableFallback) columns = [...PRESETS.single.layout.columns, ...columns];
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
  const pending = [...layout.header, ...layout.columns, ...layout.footer].filter((e): e is CustomField => "pending" in e && e.pending === true).map((e) => e.label);
  const approvalLabels = (raw.approval_labels ?? []).map(label).filter(Boolean).slice(0, 8);
  return { layout, pending, approvalLabels, tableFallback };
}

// Gemini에 줄 항목 설명(이 목록 밖으로는 짝짓지 못한다)
export function bindingGuide(): string {
  const f = Object.entries(FIELD_CATALOG).map(([k, v]) => `  - ${k}: ${v.label} — ${v.hint}`);
  const c = Object.entries(COLUMN_CATALOG).map(([k, v]) => `  - ${k}: ${v.label}${v.hint ? ` — ${v.hint}` : ""}`);
  return `헤더/표 아래 칸에 쓸 수 있는 항목:\n${f.join("\n")}\n표 열에 쓸 수 있는 항목:\n${c.join("\n")}`;
}
