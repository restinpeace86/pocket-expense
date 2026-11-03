"use client";

import type { createClient } from "@/lib/supabase/client";

// 첨부 서명 주소 재사용(D-204): 같은 파일은 같은 주소로 다시 열어 브라우저 저장본(캐시)을 쓰게 한다.
// 주소는 1시간짜리, 50분까지 재사용. 새로고침해도 이 탭 안에서는(sessionStorage) 그대로
const TTL = 3600;
const REUSE_MS = 50 * 60 * 1000;
const KEY = "chat-signed-urls";
type Entry = { url: string; at: number };
let cache: Map<string, Entry> | null = null;

function load(): Map<string, Entry> {
  if (cache) return cache;
  cache = new Map();
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) if (Date.now() - v.at < REUSE_MS) cache.set(k, v);
  } catch {}
  return cache;
}
function save() {
  try {
    const now = Date.now();
    const obj: Record<string, Entry> = {};
    for (const [k, v] of load()) if (now - v.at < REUSE_MS) obj[k] = v;
    sessionStorage.setItem(KEY, JSON.stringify(obj));
  } catch {}
}

function cachedSignedUrl(path: string): string | undefined {
  const e = load().get(path);
  return e && Date.now() - e.at < REUSE_MS ? e.url : undefined;
}

export async function signedUrls(supabase: ReturnType<typeof createClient>, bucket: string, paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const need: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cachedSignedUrl(p);
    if (hit) out[p] = hit;
    else need.push(p);
  }
  if (need.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(need, TTL);
    const now = Date.now();
    for (const d of data ?? []) {
      if (!d.path || !d.signedUrl) continue;
      out[d.path] = d.signedUrl;
      load().set(d.path, { url: d.signedUrl, at: now });
    }
    save();
  }
  return out;
}
