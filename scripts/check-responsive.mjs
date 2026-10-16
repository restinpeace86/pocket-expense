// 반응형 점검: 여러 화면 폭에서 가로 스크롤(넘침)이 생기는지 확인하고 스크린샷을 남긴다.
//   npm run check:responsive                      → http://localhost:3000 의 기본 경로들
//   npm run check:responsive -- <baseUrl> [경로...] → 특정 주소·경로
// 넘침이 하나라도 있으면 종료 코드 1. 스크린샷은 .responsive/ (커밋하지 않음)
// 최초 1회: npx playwright install chromium
import { chromium } from "playwright";
import fs from "node:fs";

const DEFAULT_PATHS = ["/", "/login", "/join/ZZZZZZZZ", "/join/i/invalid-token"];
const [baseArg, ...pathArgs] = process.argv.slice(2);
const base = (baseArg ?? "http://localhost:3000").replace(/\/$/, "");
const paths = pathArgs.length ? pathArgs : DEFAULT_PATHS;
const VIEWPORTS = [
  { name: "m360", width: 360, height: 780, mobile: true },
  { name: "m390", width: 390, height: 844, mobile: true },
  { name: "t768", width: 768, height: 1024, mobile: true },
  { name: "pc1280", width: 1280, height: 800, mobile: false },
];
const outDir = ".responsive";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;
for (const p of paths) {
  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      isMobile: v.mobile,
      hasTouch: v.mobile,
      locale: "ko-KR",
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(base + p, { waitUntil: "networkidle" });
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1)) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
        }
      }
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders: offenders.slice(0, 3) };
    });
    const file = `${outDir}/${p.replace(/[^a-z0-9]+/gi, "_") || "root"}_${v.name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const overflow = m.scrollWidth > m.clientWidth;
    if (overflow) failures++;
    console.log(`${overflow ? "FAIL" : "ok  "} ${p.padEnd(24)} ${v.name.padEnd(7)} ${m.scrollWidth}/${m.clientWidth}${overflow ? "  " + m.offenders.join(" | ") : ""}`);
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\n가로 넘침 ${failures}건 — 수정 필요` : "\n모든 화면 폭에서 가로 넘침 없음");
process.exitCode = failures ? 1 : 0;
