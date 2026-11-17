import "server-only";
import { tryGemini } from "@/lib/ai/gemini-retry";
import { CELL, PROMPT as TABLE_PROMPT, readPagesDetailed } from "@/lib/doc-convert/gemini";
import { ALL_STD_KEYS, DOC_TYPE_CODES, DOC_TYPES, stdKey } from "./doc-types";
import { dataKeysFor, DATA_LABEL, INPUT_LABEL, type AiFormPage, type FormKind, KIND_LABEL } from "./model";

// 회사 양식 사진·PDF → 표 모양 + 값 칸(8-104 B). 서류 → 엑셀과 같은 표 읽기에 "값 칸 표시(slot)"를 더한다. 크레딧은 쓰지 않는다
function schema(kind: FormKind) {
  const cell = {
    ...CELL,
    properties: {
      ...CELL.properties,
      slot_label: { type: "string", nullable: true },
      // 결재 문서(9-33d)는 종류별 표준 칸 키(예: pumui.amount)도 고를 수 있다
      slot_data: { type: "string", enum: [...dataKeysFor(kind), ...(kind === "general" ? ALL_STD_KEYS : []), "none"], nullable: true },
    },
  };
  return {
    type: "object",
    properties: {
      pages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", nullable: true },
            ...(kind === "general" ? { doc_type: { type: "string", enum: DOC_TYPE_CODES, nullable: true } } : {}),
            col_widths: { type: "array", items: { type: "number" } },
            rows: { type: "array", items: { type: "object", properties: { height: { type: "integer" }, cells: { type: "array", items: cell } }, required: ["cells"] } },
          },
          required: ["col_widths", "rows"],
        },
      },
    },
    required: ["pages"],
  };
}

function prompt(kind: FormKind) {
  const keys = dataKeysFor(kind)
    .map((k) => `  - ${k}: ${DATA_LABEL[k]}`)
    .join("\n");
  return `${TABLE_PROMPT}

이 서류는 회사의 빈 "${kind === "general" ? "결재 문서(품의서·구매요청서·시말서 등)" : KIND_LABEL[kind]}" 양식입니다. 위 규칙대로 표를 읽고, 추가로 **값이 들어갈 빈 칸**을 표시해 주세요.
- 값 칸(신청할 때 내용이 채워지는 칸)에만 slot_label을 넣으세요: 그 칸의 이름(보통 왼쪽이나 위 라벨 칸 글자, 예: "성명", "휴가 기간", "업무 대행자")
- 라벨 칸·제목·안내 문장에는 slot_label을 넣지 마세요(null)
- slot_data: 그 값 칸에 넣을 우리 데이터 키. 뜻이 맞는 것이 없으면 반드시 "none"(억지로 짝짓지 마세요)
${keys}
- 결재란(담당·팀장·대표 같은 도장 칸): 이름 칸 아래 빈 도장 칸마다 왼쪽부터 approval.1, approval.2 … (slot_label은 그 칸 이름, 예: "담당")
- "□연차 □반차 □병가"처럼 고르는 칸은 칸 하나로 leave.type
- "  년  월  일 ~  년  월  일 (  일간)" 같은 기간 칸은 leave.period(휴가신청서일 때)
- 근태 정정 신청서: "변경 전/정정 전" 시각 칸은 correction.before(출근·퇴근이 따로면 correction.before_in·before_out), "변경 후/정정 후"는 correction.after(…_in·…_out), 날짜는 correction.date
- 휴일·연장근무 신청서: 근무 일자는 holiday.date, "~시부터 ~시까지"는 holiday.time, 근무 시간 합계는 holiday.hours, 업무 내용은 holiday.work
- 아래쪽 "  년  월  일" 날짜 줄은 doc.date, "신청인 ____ (인)"의 이름 자리는 member.name
- title: 서류 맨 위 제목(예: "휴 가 신 청 서")${kind === "general" ? GENERAL_HINT : ""}`;
}

// 결재 문서: 종류 고르기 + 종류별 표준 칸(9-33d). 짝이 없는 칸은 none(직원이 입력하는 칸이 됨)
const GENERAL_HINT = `
- doc_type: 이 서류의 종류. 제목·내용을 보고 아래에서 하나(첫 쪽에만). 맞는 것이 없으면 other
${DOC_TYPES.filter((d) => d.code !== "other")
  .map((d) => `  - ${d.code}: ${d.label} — 표준 칸 ${d.fields.map((x) => `${stdKey(d.code, x.key)}(${x.label}·${INPUT_LABEL[x.type]})`).join(", ")}`)
  .join(String.fromCharCode(10))}
- 값 칸의 slot_data는 위 우리 데이터 키, 또는 **고른 doc_type의 표준 칸 키**(예: 품의서의 금액 칸 → pumui.amount). 다른 종류의 표준 칸 키는 쓰지 마세요. 뜻이 맞는 것이 없으면 none`;

export async function readFormWithGemini(file: { data: ArrayBuffer; mimeType: string }, kind: FormKind): Promise<{ pages: AiFormPage[] | null; busy: boolean }> {
  const r = await readPagesDetailed(file, prompt(kind), schema(kind));
  return { pages: r.pages as AiFormPage[] | null, busy: r.busy };
}
