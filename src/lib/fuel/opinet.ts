// 오피넷(Opinet) 전국 주유소 평균 가격 (D-117)
// API: https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code={인증키}
//   응답 예: {"RESULT":{"OIL":[{"TRADE_DT":"20261022","PRODCD":"B027","PRODNM":"휘발유","PRICE":"1680.12","DIFF":"-0.35"}, ...]}}
//   제품 코드: B027 보통휘발유 / D047 자동차용경유 / K015 자동차용부탄(LPG) (B034 고급휘발유·C004 실내등유는 쓰지 않음)
// 인증키는 오피넷 회원가입 후 [유가정보 API] 신청으로 무료 발급 → 서버 환경 변수 OPINET_API_KEY. 키는 브라우저로 보내지 않는다.

export type OilPrices = { logDate: string; gasoline: number | null; diesel: number | null; lpg: number | null };

const CODE = { gasoline: "B027", diesel: "D047", lpg: "K015" } as const;

// 응답 JSON → 일자·유종별 가격. 형식이 다르면 오류(이유와 함께)
export function parseOpinetAvgAll(json: unknown): { ok: true; prices: OilPrices } | { ok: false; error: string } {
  const list = (json as { RESULT?: { OIL?: unknown } } | null)?.RESULT?.OIL;
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: "응답에 RESULT.OIL 목록이 없어요(인증키·호출 한도 확인)" };
  const rows = list as { TRADE_DT?: unknown; PRODCD?: unknown; PRICE?: unknown }[];
  const priceOf = (code: string): number | null => {
    const r = rows.find((x) => x.PRODCD === code);
    const n = Number(String(r?.PRICE ?? "").replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 100) / 100 : null;
  };
  const dt = String(rows.find((x) => typeof x.TRADE_DT === "string")?.TRADE_DT ?? "");
  if (!/^\d{8}$/.test(dt)) return { ok: false, error: `기준일(TRADE_DT) 형식이 이상해요: ${dt.slice(0, 20)}` };
  const prices: OilPrices = { logDate: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`, gasoline: priceOf(CODE.gasoline), diesel: priceOf(CODE.diesel), lpg: priceOf(CODE.lpg) };
  if (prices.gasoline === null && prices.diesel === null && prices.lpg === null) return { ok: false, error: "휘발유·경유·LPG 가격을 하나도 찾지 못했어요" };
  return { ok: true, prices };
}

// 호출: 10초 시간 제한, 실패하면 한 번 더(5초 뒤)
export async function fetchOpinetAvgAll(key: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; prices: OilPrices } | { ok: false; error: string }> {
  const url = `https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code=${encodeURIComponent(key)}`;
  let last = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
      } else {
        const text = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          last = `JSON이 아닌 응답: ${text.slice(0, 80)}`;
          json = null;
        }
        if (json !== null) {
          const parsed = parseOpinetAvgAll(json);
          if (parsed.ok) return parsed;
          last = parsed.error;
        }
      }
    } catch (e) {
      last = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 5_000));
  }
  return { ok: false, error: last || "알 수 없는 오류" };
}
