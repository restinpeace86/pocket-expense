import "server-only";
import { todayKst } from "@/lib/dates";
import { normalizeParsed, type ParsedReceipt } from "./parse-result";

// Gemini Vision 영수증 인식 어댑터 (receipt-parser.md, D-006·D-073)
// - 보관본(2000px)을 그대로 보낸다(썸네일 금지). JSON 스키마로 응답을 강제하고, 결과는 normalizeParsed로 다시 검사한다.
// - 한 번에 15초까지 기다리고, 실패하면 1회 다시 시도한다. 다시 시도할 때는 다른 모델을 쓴다(한 모델이 혼잡해도 이어지게).
// - 모델(2026-10-20 실측, 같은 영수증): flash-lite 1.3초·정확 / flash 40초 무응답(혼잡). 체감 목표 1~3초(receipt-parser.md §4)라 lite를 기본으로 둔다.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const TIMEOUT_MS = 15_000;

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type, nullable: true, ...extra });
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    merchant_name: nullable("string"),
    merchant_business_number: nullable("string"),
    card_number_masked: nullable("string"),
    suggested_evidence_type: nullable("string", { enum: ["card_slip", "cash_receipt", "tax_invoice", "simple_receipt"] }),
    suggested_evidence_kind: nullable("string", { enum: ["receipt", "invoice", "app_history", "card_history", "invitation", "other"] }),
    cash_receipt_income_deduction: nullable("boolean"),
    amount: nullable("integer"),
    supply_amount: nullable("integer"),
    vat_amount: nullable("integer"),
    expense_date: nullable("string"),
    suggested_category: nullable("string", { enum: ["meal", "trip", "meeting", "purchase"] }),
    suggested_trip_type: nullable("string", { enum: ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other", "car_fuel"] }),
    suggested_purchase_type: nullable("string", { enum: ["pantry", "office_supplies", "small_equipment"] }),
    suggested_purpose: nullable("string"),
    paid_time: nullable("string"),
    approval_number: nullable("string"),
    merchant_address: nullable("string"),
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, quantity: nullable("number"), unit_price: nullable("integer"), amount: nullable("integer") },
        required: ["name"],
      },
    },
  },
  required: ["merchant_name", "amount", "expense_date"],
};

function prompt(isBusinessTrip: boolean, today: string) {
  return `한국 영수증(카드매출전표·현금영수증·세금계산서·간이영수증·배달앱/교통 예매 캡처 등) 이미지에서 다음 값을 JSON으로 뽑아 주세요. 보이지 않거나 확신이 없으면 null로 두고, 계산해서 만들어 내지 마세요.
- merchant_name: 가맹점(상호)명
- merchant_business_number: 가맹점 사업자등록번호(숫자 10자리)
- card_number_masked: 영수증에 찍힌 카드번호를 보이는 그대로. *·X 등으로 가려진 자리는 *로 적고, 가려진 숫자를 추측해 채우지 마세요(예: "5327-12**-****-432*"). 카드번호가 없으면 null
- suggested_evidence_type: "신용승인·카드번호 마스킹"이면 card_slip, "현금영수증"이면 cash_receipt, "세금계산서·공급받는자"면 tax_invoice, 사업자 정보 없는 수기 영수증이면 simple_receipt
- suggested_evidence_kind: 자료 종류. 종이·전자 영수증 receipt, 해외 서비스 인보이스·결제 확인 메일 invoice, 택시·배달·교통 앱의 이용 내역 화면 invoice가 아니면 app_history, 카드사 앱·문자의 결제 내역 card_history, 청첩장·부고 안내 invitation, 그 밖 other
- cash_receipt_income_deduction: 현금영수증이 "소득공제용"이면 true, "지출증빙용"이면 false
- amount: 총 결제금액(합계, 원 단위 정수)
- supply_amount / vat_amount: 공급가액 / 부가세. 표기가 없으면 null
- expense_date: 결제일자 YYYY-MM-DD (오늘은 ${today})
- suggested_category: 식당·카페 식사는 meal, 교통·숙박·통행료는 trip, 거래처 접대로 보이면 meeting, 편의점·마트·문구점·전자제품 매장 구매는 purchase. 판단이 어려우면 null
${isBusinessTrip ? "- 이 영수증은 출장 결의서에 올라왔습니다. suggested_category는 trip으로 하고 suggested_trip_type을 판단하세요" : "- 식당 영수증은 suggested_category를 meal로 하세요"}
- suggested_trip_type(출장비일 때): 식당 meal, 승차권·항공권 public_transport, 택시 taxi, 톨게이트·하이패스·주차장 toll_parking, 주유소(기름값) car_fuel, 호텔·숙박 lodging, 그 밖 other
- suggested_purchase_type(물품 구매일 때): 간식·음료·생수 pantry, 펜·A4 용지·문구·소모품 office_supplies, 책상·의자·노트북·모니터·프린터·복합기·에어컨처럼 오래 쓰는 물건(비품) small_equipment
- suggested_purpose: 회계 장부·관리자 검토에 맞는 정중한 업무용 지출 사유 한 줄(25자 이내, 명사형으로 끝냄, 마침표 없음). 영수증에서 알 수 있는 사실(가맹점 종류·품목·시간대)만 쓰고 사람 이름·회사 이름·참석자를 지어내지 마세요. 예: 다이소 문구 → "사내 비품 및 소모품 구입", 카페 음료 여러 잔 → "팀원 실무 회의 및 다과 진행", 한식당 점심 → "부서 정기 점심 식사 진행"
- paid_time: 결제(거래) 시각 HH:MM (24시간)
- approval_number: 카드·현금영수증 승인번호
- merchant_address: 영수증에 적힌 가맹점 주소 그대로
- line_items: 품목별 내역(이름, 수량, 단가, 금액). 영수증에 적힌 순서대로, 최대 50줄. 할인은 금액을 음수로. 단가·수량은 영수증에 적혀 있을 때만(나눠서 계산하지 말 것). 품목이 안 보이면 빈 배열`;
}

async function callOnce(model: string, apiKey: string, body: unknown): Promise<unknown> {
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
  return JSON.parse(text);
}

// 실패하면 null (키 미설정 포함) — 화면은 "자동 인식에 실패했어요. 직접 입력해 주세요"로 안내한다
export async function parseReceiptWithGemini(file: { data: ArrayBuffer; mimeType: string }, isBusinessTrip: boolean): Promise<ParsedReceipt | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const today = todayKst();
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: file.mimeType, data: Buffer.from(file.data).toString("base64") } },
          { text: prompt(isBusinessTrip, today) },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0 },
  };
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      return normalizeParsed(await callOnce(model, apiKey, body), today);
    } catch {
      // 다음 모델로 1회 재시도
    }
  }
  return null;
}
