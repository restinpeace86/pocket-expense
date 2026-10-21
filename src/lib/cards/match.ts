// 법인카드 번호 맞추기 (corporate-cards.md §3, D-083)
// 카드는 앞 6자리(BIN)·뒤 4자리만 저장한다. 영수증은 가운데를 *로 가려 찍고, 앞·뒤 자리도 일부 가리는 경우가 있다(예: 432*).
// 그래서 영수증에서 보이는 숫자만 등록 카드와 비교하고, 가려진 자리(*)는 비교하지 않는다.
// 같은 규칙이 서버 함수(private.mask_card_number, private.card_number_matches)에도 있다 — 바꾸면 함께 고친다.

export type MatchCard = { id: string; bin6: string | null; last4: string };
export type CardMatch =
  | { kind: "unknown" } // 보이는 숫자가 없음(현금·배달앱 캡처 등) → 결의서 기본값 유지
  | { kind: "unique"; cardId: string } // 등록 카드 1장과 맞음 → 법인카드 + 그 카드
  | { kind: "ambiguous"; cardIds: string[] } // 2장 이상과 맞음 → 법인카드, 카드는 직원이 고름
  | { kind: "mismatch" }; // 어느 카드와도 안 맞음 → 개인(사비) 추천

const FULL_MIN = 13; // 이 길이 이상이면 카드번호 전체 자리를 찍은 것으로 보고 앞 6자리도 비교한다

// 영수증 카드번호 → 숫자와 *만 남긴 표준 형태. 앞 6자리·뒤 4자리 말고는 숫자가 있어도 *로 바꾼다(전체 번호 저장 방지).
// 짧게 찍힌 번호(예: "****7890", "7890")는 뒤 4자리만 남긴다.
export function maskCardNumber(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw)
    .replace(/[xX●•#]/g, "*")
    .replace(/[^0-9*]/g, "")
    .slice(0, 19);
  if (s.length < 4) return null;
  const keepFront = s.length >= FULL_MIN ? 6 : 0;
  const masked = [...s].map((ch, i) => (i < keepFront || i >= s.length - 4 ? ch : "*")).join("");
  return /\d/.test(masked) ? masked : null;
}

// 보이는 숫자가 모두 맞으면 true, 하나라도 다르면 false, 비교할 숫자가 없으면 null
export function cardNumberMatches(masked: string, card: Pick<MatchCard, "bin6" | "last4">): boolean | null {
  let compared = 0;
  const back = masked.slice(-4);
  for (let i = 0; i < 4; i++) {
    const ch = back[i];
    if (ch === "*" || ch === undefined) continue;
    if (ch !== card.last4[i]) return false;
    compared++;
  }
  if (masked.length >= FULL_MIN && card.bin6) {
    for (let i = 0; i < 6; i++) {
      const ch = masked[i];
      if (ch === "*") continue;
      if (ch !== card.bin6[i]) return false;
      compared++;
    }
  }
  return compared > 0 ? true : null;
}

export function matchCard(masked: string | null | undefined, cards: MatchCard[]): CardMatch {
  if (!masked || !/\d/.test(masked)) return { kind: "unknown" };
  const results = cards.map((c) => ({ id: c.id, r: cardNumberMatches(masked, c) }));
  if (results.every((x) => x.r === null)) return { kind: "unknown" };
  const hits = results.filter((x) => x.r === true).map((x) => x.id);
  if (hits.length === 1) return { kind: "unique", cardId: hits[0] };
  if (hits.length > 1) return { kind: "ambiguous", cardIds: hits };
  return { kind: "mismatch" };
}

// 표시용: "532712******432*" → "5327-12**-****-432*"
export function formatMaskedCard(masked: string): string {
  return masked.match(/.{1,4}/g)?.join("-") ?? masked;
}

// 등록 카드 표시: 앞 6자리가 있으면 "1234-56**-****-7890", 없으면 "****-****-****-7890"
export function formatCardNumber(card: Pick<MatchCard, "bin6" | "last4">): string {
  return card.bin6 ? `${card.bin6.slice(0, 4)}-${card.bin6.slice(4)}**-****-${card.last4}` : `****-****-****-${card.last4}`;
}
