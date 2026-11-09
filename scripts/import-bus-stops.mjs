// 서울 버스 정류장 위치 받기(D-243): 서울 열린데이터 busStopLocationXyInfo → public.bus_stops
// NODE_ID = 정류소 번호(arsId, getStationByUid에 씀), STOPS_NO = 정류소 ID. 5자리 번호가 없는 것(선착장 등)은 뺀다
// 쓰기: node scripts/import-bus-stops.mjs   (SEOUL_OPEN_DATA_KEY · Supabase service role 필요 — 값은 출력하지 않음)
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const key = process.env.SEOUL_OPEN_DATA_KEY ?? env.SEOUL_OPEN_DATA_KEY;
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rows = [];
for (let start = 1; ; start += 1000) {
  const r = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/busStopLocationXyInfo/${start}/${start + 999}/`);
  const j = await r.json();
  const list = j.busStopLocationXyInfo?.row ?? [];
  for (const s of list) {
    if (!/^\d{5}$/.test(s.NODE_ID ?? "")) continue;
    rows.push({ ars_id: s.NODE_ID, st_id: s.STOPS_NO, name: s.STOPS_NM, lat: Number(s.YCRD), lng: Number(s.XCRD), region: "seoul", updated_at: new Date().toISOString() });
  }
  if (list.length < 1000) break;
}
// 같은 번호가 두 번 나오면 마지막 것
const byArs = new Map(rows.map((r) => [r.ars_id, r]));
const all = [...byArs.values()];
for (let i = 0; i < all.length; i += 1000) {
  const { error } = await admin.from("bus_stops").upsert(all.slice(i, i + 1000), { onConflict: "ars_id" });
  if (error) throw new Error(error.message);
}
console.log(`정류장 ${all.length}곳 저장(받은 줄 ${rows.length})`);
