import "server-only";
import { CELL, PROMPT as TABLE_PROMPT, readPagesWithGemini } from "@/lib/doc-convert/gemini";
import { dataKeysFor, DATA_LABEL, type AiFormPage, type FormKind } from "./model";

// 회사 양식 사진·PDF → 표 모양 + 값 칸(8-104 B). 서류 → 엑셀과 같은 표 읽기에 "값 칸 표시(slot)"를 더한다. 크레딧은 쓰지 않는다
function schema(kind: FormKind) {
  const cell = {
    ...CELL,
    properties: {
      ...CELL.properties,
      slot_label: { type: "string", nullable: true },
      slot_data: { type: "string", enum: [...dataKeysFor(kind), "none"], nullable: true },
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

이 서류는 회사의 빈 "${kind === "leave" ? "휴가신청서" : "결재 문서(품의서·구매요청서·시말서 등)"}" 양식입니다. 위 규칙대로 표를 읽고, 추가로 **값이 들어갈 빈 칸**을 표시해 주세요.
- 값 칸(신청할 때 내용이 채워지는 칸)에만 slot_label을 넣으세요: 그 칸의 이름(보통 왼쪽이나 위 라벨 칸 글자, 예: "성명", "휴가 기간", "업무 대행자")
- 라벨 칸·제목·안내 문장에는 slot_label을 넣지 마세요(null)
- slot_data: 그 값 칸에 넣을 우리 데이터 키. 뜻이 맞는 것이 없으면 반드시 "none"(억지로 짝짓지 마세요)
${keys}
- 결재란(담당·팀장·대표 같은 도장 칸): 이름 칸 아래 빈 도장 칸마다 왼쪽부터 approval.1, approval.2 … (slot_label은 그 칸 이름, 예: "담당")
- "□연차 □반차 □병가"처럼 고르는 칸은 칸 하나로 leave.type
- "  년  월  일 ~  년  월  일 (  일간)" 같은 기간 칸은 leave.period
- 아래쪽 "  년  월  일" 날짜 줄은 doc.date, "신청인 ____ (인)"의 이름 자리는 member.name
- title: 서류 맨 위 제목(예: "휴 가 신 청 서")`;
}

export async function readFormWithGemini(file: { data: ArrayBuffer; mimeType: string }, kind: FormKind): Promise<AiFormPage[] | null> {
  return (await readPagesWithGemini(file, prompt(kind), schema(kind))) as AiFormPage[] | null;
}
