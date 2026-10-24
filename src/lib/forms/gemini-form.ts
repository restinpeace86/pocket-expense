import "server-only";
import { COLUMN_CATALOG, FIELD_CATALOG } from "./layout";
import { bindingGuide, type AiFormRead } from "./ai-layout";

// 종이 지출결의서 양식 사진/PDF → 칸 읽기 (D-006 Gemini, D-118). 영수증 어댑터와 같은 방식(JSON 스키마 강제, 다른 모델로 1회 재시도)
const PRIMARY_MODEL = process.env.GEMINI_FORM_MODEL || process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const TIMEOUT_MS = 30_000;

const fieldEnum = [...Object.keys(FIELD_CATALOG), "none"];
const columnEnum = [...Object.keys(COLUMN_CATALOG), "none"];
const pair = (e: string[]) => ({ type: "array", items: { type: "object", properties: { label: { type: "string" }, binding: { type: "string", enum: e } }, required: ["label", "binding"] } });
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", nullable: true },
    approval_labels: { type: "array", items: { type: "string" } },
    header_fields: pair(fieldEnum),
    table_columns: pair(columnEnum),
    footer_fields: pair(fieldEnum),
    statement: { type: "string", nullable: true },
    has_date: { type: "boolean" },
    signer_label: { type: "string", nullable: true },
    has_company_line: { type: "boolean" },
  },
  required: ["title", "approval_labels", "header_fields", "table_columns", "footer_fields", "has_date", "has_company_line"],
};

const PROMPT = `한국 회사의 빈 "지출결의서" 양식(사진·스캔·PDF)입니다. 양식의 구성을 위에서 아래 순서대로 읽고, 각 칸이 아래 "쓸 수 있는 항목" 중 무엇에 해당하는지 짝지어 JSON으로 주세요.
- title: 양식 맨 위 제목 그대로(예: "지 출 결 의 서", "지출 (청구) 결의서")
- approval_labels: 오른쪽 위 결재란(도장 칸)의 칸 이름들(예: 담당, 팀장, 이사, 대표). 없으면 빈 배열
- header_fields: 표(반복되는 행) 위에 있는 "라벨 | 값" 칸들. label은 양식에 적힌 이름 그대로
- table_columns: 반복되는 내역 표의 열 이름(왼쪽부터). "카드/현금"처럼 한 열이 둘로 나뉘면 하나의 열로
- footer_fields: 내역 표 아래의 "라벨 | 값" 칸들(특이사항, 비고, 입금 정보 등)
- statement: 아래쪽 맺음말 문장(예: "위와 같은 금액을 청구하오니 결재하여 주시기 바랍니다."). 날짜 기간이 문장 안에 있으면 그 자리를 "{기간}"으로
- has_date: 맺음말 아래 "년 월 일" 날짜 줄이 있으면 true
- signer_label: "작성자: ____ (인)", "청구인 ____ (인)" 같은 서명 줄의 이름(예: "작성자", "청구인"). 없으면 null
- has_company_line: 맨 아래 회사 이름 줄(예: "주식회사 ○○")이 있으면 true
- binding: 칸의 뜻이 가장 가까운 항목 키. 내역 표의 품목명·항목·내역 열은 item.line_name, 수량은 item.quantity, 단가는 item.unit_price. 표 아래 특이사항·비고 칸은 claim.description(지출 사유). 아래 목록에 뜻이 맞는 것이 없으면 반드시 "none"(억지로 짝짓지 마세요). 예: 보존 기간·예산 코드처럼 목록에 없는 것은 "none"
- 같은 뜻의 칸이 여러 개면 처음 것만 짝짓고 나머지는 "none"
${bindingGuide()}`;

async function callOnce(model: string, apiKey: string, body: unknown): Promise<AiFormRead> {
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
  return JSON.parse(text) as AiFormRead;
}

// 실패하면 null(키 미설정 포함) — 화면은 "양식을 읽지 못했어요. 기본 포맷에서 직접 꾸며 주세요"로 안내
export async function readFormWithGemini(file: { data: ArrayBuffer; mimeType: string }): Promise<AiFormRead | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: file.mimeType, data: Buffer.from(file.data).toString("base64") } }, { text: PROMPT }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0 },
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
