// Gemini 부르기 공통: 기본 모델 → 대체 모델, 모델마다 'AI가 바쁨'(429·500·502·503·504)이면 잠깐 쉬고 한 번 더(2026-11-18).
// 사진이 멀쩡한데 Google 서버가 몰려 503을 주면, 예전엔 바로 "표를 찾지 못했어요 — 다시 찍어 주세요"가 떠서 사용자가 사진을 탓했다.
// 결과: 값이 있으면 value, 끝내 실패면 busy(바쁨으로 끝났나)로 알맞은 안내를 고를 수 있게 한다. 실패 이유는 서버 기록에만(내용 없이)
export type GeminiTry<T> = { ok: true; value: T } | { ok: false; busy: boolean };

const TRANSIENT = /gemini (429|500|502|503|504)\b/;
export const isTransient = (e: unknown) => e instanceof Error && (TRANSIENT.test(e.message) || e.name === "TimeoutError");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function tryGemini<T>(models: string[], call: (model: string) => Promise<T>, label: string, opts: { retries?: number; delayMs?: number } = {}): Promise<GeminiTry<T>> {
  const retries = opts.retries ?? 1;
  const delay = opts.delayMs ?? 1500;
  let busy = false;
  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      try {
        return { ok: true, value: await call(model) };
      } catch (e) {
        const transient = isTransient(e);
        busy = transient;
        console.warn(`[gemini:${label}] ${model} ${attempt + 1}번째 실패 ${Math.round((Date.now() - t0) / 1000)}초: ${e instanceof Error ? e.message.slice(0, 120) : "?"}`);
        if (!transient) break; // 바쁨이 아니면(응답이 깨짐 등) 같은 모델로 다시 해도 같으니 다음 모델로
        if (attempt < retries) await wait(delay * (attempt + 1));
      }
    }
  }
  return { ok: false, busy };
}
