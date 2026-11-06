// 안드로이드 설치 앱(APK)을 공개 저장소에 올린다(D-228). 새 버전은 같은 이름으로 덮어쓴다.
// 사용: node scripts/upload-android-apk.mjs  (먼저 mobile/android에서 assembleRelease — implementation/2026-11-06_android-app.md)
// 키는 .env.local의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(화면에 출력하지 않음)
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const APK = "mobile/android/app/build/outputs/apk/release/app-release.apk";
const PATH = "android/workon.apk";
if (!fs.existsSync(APK)) {
  console.error(`APK가 없어요: ${APK}`);
  process.exit(1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const file = fs.readFileSync(APK);
const { error } = await sb.storage.from("app-downloads").upload(PATH, file, { contentType: "application/vnd.android.package-archive", upsert: true, cacheControl: "300" });
if (error) {
  console.error(`올리지 못했어요: ${error.message}`);
  process.exit(1);
}
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/app-downloads/${PATH}?t=${Date.now()}`, { method: "HEAD" });
console.log(`올림 ${(file.length / 1024 / 1024).toFixed(1)}MB → 공개 주소 응답 ${r.status} ${r.headers.get("content-type")} ${r.headers.get("content-length")}`);
