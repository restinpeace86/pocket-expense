// Supabase Management API로 SQL을 실행한다. 비밀값(토큰)은 출력하지 않는다.
//   node scripts/supabase-sql.mjs --migrate            supabase/migrations/*.sql 중 아직 적용 안 된 것만 순서대로 적용
//   node scripts/supabase-sql.mjs --file <path.sql>    SQL 파일 1개 실행 (예: 격리 테스트)
//   node scripts/supabase-sql.mjs --types <out.ts>     DB 타입(TypeScript) 생성
// 필요한 .env.local 키: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local이 없습니다.");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_ACCESS_TOKEN) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN이 .env.local에 필요합니다.");
  }
  return {
    ref: new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0],
    token: env.SUPABASE_ACCESS_TOKEN,
  };
}

async function runSql({ ref, token }, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try { message = JSON.parse(text).message ?? text; } catch { /* keep raw text */ }
    throw new Error(message);
  }
  return JSON.parse(text);
}

async function migrate(cfg) {
  await runSql(cfg, `
    create schema if not exists private;
    create table if not exists private.applied_migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const applied = new Set((await runSql(cfg, "select name from private.applied_migrations")).map((r) => r.name));
  const dir = path.resolve("supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) { console.log(`skip    ${file}`); continue; }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const name = file.replace(/'/g, "''");
    await runSql(cfg, `begin;\n${sql}\ninsert into private.applied_migrations (name) values ('${name}');\ncommit;`);
    console.log(`applied ${file}`);
  }
}

async function generateTypes({ ref, token }, outFile) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`타입 생성 실패: ${res.status} ${await res.text()}`);
  const { types } = await res.json();
  fs.writeFileSync(outFile, types);
  console.log(`types → ${outFile}`);
}

const [mode, arg] = process.argv.slice(2);
try {
  const cfg = loadEnv();
  if (mode === "--migrate") await migrate(cfg);
  else if (mode === "--file" && arg) console.log(JSON.stringify(await runSql(cfg, fs.readFileSync(arg, "utf8"))));
  else if (mode === "--types" && arg) await generateTypes(cfg, arg);
  else { console.error("usage: --migrate | --file <sql> | --types <out.ts>"); process.exitCode = 2; }
} catch (err) {
  console.error(`SQL 실행 실패: ${err.message}`);
  process.exitCode = 1;
}
