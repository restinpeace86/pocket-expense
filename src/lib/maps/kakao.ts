import "server-only";

// Kakao Local(장소·주소 검색) + Kakao Mobility(길찾기 거리) 어댑터 (trip-expense.md §4.1, D-085)
// 키(KAKAO_REST_API_KEY)는 서버에서만 쓴다. 키가 없거나 실패하면 빈 결과/null → 화면은 직접 입력으로 안내한다(§4.3).
export type Place = { name: string; address: string | null; lat: number; lng: number };

const TIMEOUT_MS = 5000;

function key(): string | null {
  return process.env.KAKAO_REST_API_KEY || null;
}

async function kakaoGet(url: string): Promise<unknown | null> {
  const k = key();
  if (!k) return null;
  try {
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${k}` }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type KakaoDoc = { place_name?: string; address_name?: string; road_address_name?: string; road_address?: { address_name?: string } | null; x?: string; y?: string };

function toPlace(d: KakaoDoc): Place | null {
  const lat = Number(d.y);
  const lng = Number(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = d.road_address_name || d.road_address?.address_name || d.address_name || null;
  const name = d.place_name || address;
  return name ? { name: name.slice(0, 100), address: address?.slice(0, 200) ?? null, lat, lng } : null;
}

// 장소 이름(예: "판교역", "OO 물류센터")과 주소(예: "부산 동구 중앙대로 206")를 모두 찾는다
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = encodeURIComponent(query);
  const [kw, addr] = await Promise.all([
    kakaoGet(`https://dapi.kakao.com/v2/local/search/keyword.json?size=7&query=${q}`),
    kakaoGet(`https://dapi.kakao.com/v2/local/search/address.json?size=3&query=${q}`),
  ]);
  const docs = [...(((addr as { documents?: KakaoDoc[] } | null)?.documents ?? []) as KakaoDoc[]), ...(((kw as { documents?: KakaoDoc[] } | null)?.documents ?? []) as KakaoDoc[])];
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const d of docs) {
    const p = toPlace(d);
    if (!p) continue;
    const k = `${p.name}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= 8) break;
  }
  return out;
}

// 자동차 추천 경로의 편도 거리(m)·시간(초). 실패하면 null
export async function routeDistance(start: Pick<Place, "lat" | "lng">, end: Pick<Place, "lat" | "lng">): Promise<{ meters: number; seconds: number } | null> {
  const j = (await kakaoGet(
    `https://apis-navi.kakaomobility.com/v1/directions?origin=${start.lng},${start.lat}&destination=${end.lng},${end.lat}&priority=RECOMMEND&summary=true`,
  )) as { routes?: { result_code?: number; summary?: { distance?: number; duration?: number } }[] } | null;
  const r = j?.routes?.[0];
  if (!r || r.result_code !== 0 || !r.summary?.distance) return null;
  return { meters: Math.round(r.summary.distance), seconds: Math.round(r.summary.duration ?? 0) };
}
