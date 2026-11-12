// 서비스 이름·로고를 설치 앱과 정적 파일에 맞추기(9-14a). 기준 = src/lib/brand.ts 한 곳.
// 실행: node scripts/apply-brand.mjs   (Node 23.6+ — .ts를 바로 읽음. sharp는 Next.js가 이미 씀)
// 맞추는 것:
//   - 안드로이드: 앱 이름(strings.xml), 런처 아이콘 5크기(네모·원), 알림 작은 아이콘(ic_stat_notify.xml)
//   - 아이폰: 앱 이름(Info.plist), 앱 아이콘 1024(투명 없음), 시작 화면
//   - mobile/capacitor.config.json appName, mobile/www/index.html 제목, public/sw.js 이름
// 웹 화면·알림·메일·공유 이미지는 brand.ts를 바로 읽으므로 배포만 하면 된다. 끝나면 APK·아이폰 앱을 새로 빌드.
import fs from "node:fs";
import sharp from "sharp";
import { BRAND } from "../src/lib/brand.ts";

const { name, color, mark } = BRAND;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const changed = [];
function rewrite(file, fn) {
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after === before) return;
  fs.writeFileSync(file, after);
  changed.push(file);
}
function writeIfDiff(file, buf) {
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), buf) === 0) return;
  fs.writeFileSync(file, buf);
  changed.push(file);
}

// ── 이름 ─────────────────────────────────────────────────────────────
rewrite("mobile/capacitor.config.json", (s) => {
  const j = JSON.parse(s);
  j.appName = name;
  return JSON.stringify(j, null, 2);
});
rewrite("mobile/ios/App/App/Info.plist", (s) => s.replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${esc(name)}$2`));
rewrite("mobile/android/app/src/main/res/values/strings.xml", (s) =>
  s.replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${esc(name)}$2`).replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${esc(name)}$2`),
);
rewrite("mobile/www/index.html", (s) => s.replace(/<title>[^<]*<\/title>/, `<title>${esc(name)}</title>`));
rewrite("public/sw.js", (s) => s.replace(/const BRAND_NAME = "[^"]*";/, `const BRAND_NAME = ${JSON.stringify(name)};`));

// ── 아이콘 ───────────────────────────────────────────────────────────
// 그라데이션 바탕 + 가운데 흰 로고(웹 아이콘 src/app/icons/[size]과 같은 모양, 로고 = 판의 56%)
const tile = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color.main}"/><stop offset="1" stop-color="${color.deep}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g transform="translate(${size * 0.22} ${size * 0.22}) scale(${(size * 0.56) / mark.viewBox})">
    <path d="${mark.path}" fill="none" stroke="white" stroke-width="${mark.stroke}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${mark.dot.cx}" cy="${mark.dot.cy}" r="${mark.dot.r}" fill="white"/>
  </g>
</svg>`;
const mask = (size, shape) =>
  Buffer.from(`<svg width="${size}" height="${size}">${shape === "circle" ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>` : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#fff"/>`}</svg>`);
const png = (size, shape) => {
  const base = sharp(Buffer.from(tile(size)));
  return shape ? base.composite([{ input: mask(size, shape), blend: "dest-in" }]).png().toBuffer() : base.flatten({ background: color.main }).removeAlpha().png().toBuffer();
};

// 아이폰: 1024 투명 없는 아이콘(모서리는 iOS가 깎음) + 흰 바탕 가운데 둥근 아이콘 시작 화면
const IOS = "mobile/ios/App/App/Assets.xcassets";
if (fs.existsSync(IOS)) {
  writeIfDiff(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`, await png(1024));
  const icon = await png(360, "rounded");
  const splash = await sharp({ create: { width: 2732, height: 2732, channels: 3, background: "#ffffff" } })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toBuffer();
  for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) writeIfDiff(`${IOS}/Splash.imageset/${f}`, splash);
}

// 안드로이드: 런처 아이콘(네모 = 꽉 찬 판, 원 = 원 모양) 5크기 + 알림 작은 아이콘(흰색 한 가지 벡터)
const RES = "mobile/android/app/src/main/res";
for (const [d, px] of [["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192]]) {
  writeIfDiff(`${RES}/mipmap-${d}/ic_launcher.png`, await sharp(Buffer.from(tile(px))).png().toBuffer());
  writeIfDiff(`${RES}/mipmap-${d}/ic_launcher_round.png`, await png(px, "circle"));
}
const r = mark.dot.r;
rewrite(`${RES}/drawable/ic_stat_notify.xml`, () => `<?xml version="1.0" encoding="utf-8"?>
<!-- 알림 작은 아이콘(로고): 흰색 한 가지 — scripts/apply-brand.mjs가 src/lib/brand.ts로 만든다 -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="${mark.viewBox}" android:viewportHeight="${mark.viewBox}">
    <path android:strokeColor="#FFFFFFFF" android:strokeWidth="${mark.stroke}" android:strokeLineCap="round" android:strokeLineJoin="round"
        android:fillColor="#00000000" android:pathData="${mark.path}" />
    <path android:fillColor="#FFFFFFFF" android:pathData="M${mark.dot.cx - r},${mark.dot.cy}a${r},${r} 0,1 0,${2 * r} 0a${r},${r} 0,1 0,${-2 * r} 0z" />
</vector>
`);

console.log(changed.length ? `바뀐 파일 ${changed.length}개:\n  ${changed.join("\n  ")}` : "바뀐 것 없음(이미 brand.ts와 같음)");
console.log("다음: 배포 + 이름·아이콘이 바뀌었으면 안드로이드 APK·아이폰 앱 새로 빌드");
