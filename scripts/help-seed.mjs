// 도움말 글 처음 데이터 넣기(D-255): src/lib/help/seed.ts → help_articles·help_steps. DB에 없는 글만 넣는다(운영자가 고친 글은 그대로)
// --force 를 붙이면 seed.ts 내용으로 덮어쓴다(운영자 수정도 사라짐 — 처음 정리할 때만)
// 키는 .env.local의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(화면에 출력하지 않음)
import fs from "node:fs";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const jiti = createJiti(import.meta.url);
const { HELP_SEED } = await jiti.import("../src/lib/help/seed.ts");
const force = process.argv.includes("--force");

const { data: have } = await sb.from("help_articles").select("id");
const exists = new Set((have ?? []).map((r) => r.id));
let added = 0;
for (const [i, a] of HELP_SEED.entries()) {
  if (exists.has(a.id) && !force) continue;
  const row = { id: a.id, category: a.cat, audience: a.audience ?? "all", needs: a.needs ?? null, title: a.title, summary: a.summary, keywords: a.keywords, path: a.path ?? null, admin_path: a.adminPath ?? null, path_label: a.pathLabel ?? null, sim: a.sim ?? null, sort: i, published: true, updated_by_name: "처음 데이터" };
  const { error } = await sb.from("help_articles").upsert(row);
  if (error) throw new Error(`${a.id}: ${error.message}`);
  await sb.from("help_steps").delete().eq("article_id", a.id);
  const { error: se } = await sb.from("help_steps").insert(a.steps.map((s, idx) => ({ article_id: a.id, idx, body: s.body })));
  if (se) throw new Error(`${a.id} steps: ${se.message}`);
  added++;
}
console.log(`도움말 글 ${HELP_SEED.length}편 중 ${added}편 넣음${force ? "(덮어쓰기)" : ""}`);
