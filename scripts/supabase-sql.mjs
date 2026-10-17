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

// 벤치마크처럼 대량 입력 후 롤백하면 지운 행의 공간이 남아 무료 요금제 디스크가 찬다(2026-10-17 실제 발생).
// 벤치 뒤에는 반드시 표를 압축해 공간을 돌려준다. VACUUM은 트랜잭션 안에서 못 돌리므로 표마다 따로 실행한다.
const VACUUM_TABLES = ["public.expense_items", "public.expense_claims", "public.claim_approvals", "public.members", "public.companies"];
async function vacuum(cfg) {
  for (const t of VACUUM_TABLES) {
    await runSql(cfg, `vacuum full ${t};`);
    console.log(`vacuum  ${t}`);
  }
  const [size] = await runSql(cfg, "select pg_size_pretty(pg_database_size(current_database())) as db_size");
  console.log(`db size ${size.db_size}`);
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
  else if (mode === "--dry" && arg) {
    // 적용 전 시험: 마이그레이션 1개 + 테스트 파일들을 한 트랜잭션에서 실행하고 되돌린다(DB에 흔적 없음).
    // db:migrate는 대기 중인 마이그레이션을 모두 적용하므로, 반드시 이걸로 먼저 시험한다.
    const strip = (sql) => sql.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*rollback;\s*$/gim, "");
    const tests = process.argv.slice(4).map((f) => strip(fs.readFileSync(f, "utf8"))).join("\n");
    const sql = `begin;\n${fs.readFileSync(arg, "utf8")}\n${tests}\nrollback;`;
    console.log(JSON.stringify(await runSql(cfg, sql)));
  }
  else if (mode === "--vacuum") await vacuum(cfg);
  else if (mode === "--bench" && arg) {
    // 측정이 실패해도 공간은 반드시 돌려준다
    try { console.log(JSON.stringify(await runSql(cfg, fs.readFileSync(arg, "utf8")))); } finally { await vacuum(cfg); }
  }
  else { console.error("usage: --migrate | --dry <migration.sql> [test.sql...] | --file <sql> | --types <out.ts> | --vacuum | --bench <sql>"); process.exitCode = 2; }
} catch (err) {
  console.error(`SQL 실행 실패: ${err.message}`);
  process.exitCode = 1;
}
