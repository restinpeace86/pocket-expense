import "server-only";
import type { AiPage } from "./model";

// 서류 사진·PDF → 쪽마다 표(행·칸·합친 칸) (8-104 A). 양식 읽기(forms/gemini-form.ts)와 같은 방식: JSON 스키마 강제, 다른 모델로 1회 재시도
const PRIMARY_MODEL = process.env.GEMINI_DOC_MODEL || process.env.GEMINI_FORM_MODEL || process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const TIMEOUT_MS = 60_000;

export const CELL = {
  type: "object",
  properties: {
    text: { type: "string" },
    col_span: { type: "integer" },
    row_span: { type: "integer" },
    bold: { type: "boolean" },
    align: { type: "string", enum: ["left", "center", "right"] },
    shaded: { type: "boolean" },
  },
  required: ["text"],
};
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", nullable: true },
          col_widths: { type: "array", items: { type: "number" } },
          rows: { type: "array", items: { type: "object", properties: { height: { type: "integer" }, cells: { type: "array", items: CELL } }, required: ["cells"] } },
        },
        required: ["col_widths", "rows"],
      },
    },
  },
  required: ["pages"],
};

export const PROMPT = `회사 업무 서류(신청서·결의서·명세서·견적서 등)의 사진 또는 PDF입니다. 쪽마다 서류 전체를 "엑셀 시트 한 장"으로 옮길 수 있게 표 구조로 읽어 JSON으로 주세요.
- pages: 쪽마다 하나(PDF는 쪽 순서대로, 사진은 1개)
- rows: 위에서 아래로 한 줄씩. 표 밖의 제목·문장·날짜·서명 줄도 한 행(전체 너비로 합친 칸 하나)으로 넣으세요
- cells: 왼쪽부터. HTML 표처럼 col_span(가로로 합친 칸 수)·row_span(세로로 합친 칸 수)을 쓰세요. 위 행에서 row_span으로 내려온 자리는 그 행 cells에 다시 넣지 마세요
- 모든 행의 칸 너비 합(col_span 합 + 위에서 내려온 칸)은 같아야 합니다(가장 잘게 나뉜 행 기준 열 개수)
- text: 칸에 적힌 글자 그대로(빈칸은 ""). 체크박스는 ■ □ 로. 손글씨도 읽을 수 있으면 그대로, 못 읽으면 ""
- col_widths: 열마다 상대 너비(예: [1, 2, 1, 3])
- height: 보통 줄 = 1, 키가 큰 칸(사유·내용 칸 등)은 2~6
- bold: 굵은 글씨(제목·라벨), align: 가운데·오른쪽 맞춤, shaded: 회색 바탕 라벨 칸
- 서류에 표나 글자가 거의 없으면 pages를 빈 배열로`;

async function callOnce(model: string, apiKey: string, body: unknown): Promise<AiPage[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const parsed = JSON.parse(text) as { pages?: AiPage[] };
  return Array.isArray(parsed.pages) ? parsed.pages : [];
}

// 사진·PDF + 지시문 + 응답 스키마(pages 배열) → 쪽 목록. 회사 양식 읽기(company-forms/gemini.ts)도 같이 쓴다
export async function readPagesWithGemini(file: { data: ArrayBuffer; mimeType: string }, prompt: string, schema: unknown): Promise<AiPage[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: file.mimeType, data: Buffer.from(file.data).toString("base64") } }, { text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
  };
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      return await callOnce(model, apiKey, body);
    } catch {
      // 다음 모델로 1회 재시도
    }
  }
  return null;
}

// 실패하면 null(키 미설정 포함) → 크레딧을 돌려주고 "표를 찾지 못했어요"
export async function readTablesWithGemini(file: { data: ArrayBuffer; mimeType: string }): Promise<AiPage[] | null> {
  return readPagesWithGemini(file, PROMPT, RESPONSE_SCHEMA);
}
