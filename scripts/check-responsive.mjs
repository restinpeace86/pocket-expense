// 반응형 점검: 여러 화면 폭에서 가로 스크롤(넘침)이 생기는지 확인하고 스크린샷을 남긴다.
//   npm run check:responsive                      → http://localhost:3000 의 기본 경로들
//   npm run check:responsive -- <baseUrl> [경로...] → 특정 주소·경로
// 넘침이 하나라도 있으면 종료 코드 1. 스크린샷은 .responsive/ (커밋하지 않음)
// 최초 1회: npx playwright install chromium
import { chromium } from "playwright";
import fs from "node:fs";

// 로그인 후 화면은 /dev/preview/* 로 점검한다 (서버를 ENABLE_UI_PREVIEW=1로 띄워야 함). 새 화면을 만들면 여기에 추가한다.
const DEFAULT_PATHS = [
  "/", "/login", "/terms", "/privacy", "/join/ZZZZZZZZ", "/join/i/invalid-token",
  "/dev/preview/onboarding", "/dev/preview/create-company", "/dev/preview/join", "/dev/preview/join-invite", "/dev/preview/consent-dialog",
  "/dev/preview/workspace-admin", "/dev/preview/workspace-employee",
  "/dev/preview/admin-home", "/dev/preview/admin-home-team", "/dev/preview/admin-members",
  "/dev/preview/admin-members-all", "/dev/preview/admin-member-detail", "/dev/preview/admin-member-readonly", "/dev/preview/admin-member-inactive", "/dev/preview/admin-departments", "/dev/preview/admin-settings", "/dev/preview/admin-settings?theme=wine",
  "/dev/preview/admin-account-titles", "/dev/preview/admin-corporate-cards", "/dev/preview/admin-corporate-cards-empty", "/dev/preview/admin-vehicles", "/dev/preview/admin-vehicles-empty", "/dev/preview/admin-recurring", "/dev/preview/admin-recurring-empty", "/dev/preview/admin-reconcile", "/dev/preview/admin-announcements", "/dev/preview/app-admin-announcements",
  "/dev/preview/employee-home", "/dev/preview/employee-home-empty", "/dev/preview/employee-home-blocked", "/dev/preview/employee-home-rejected", "/dev/preview/employee-home?theme=emerald",
  "/dev/preview/employee-claim-edit", "/dev/preview/employee-claim-edit-empty", "/dev/preview/employee-claim-edit-trip", "/dev/preview/employee-claim-edit-owncar",
  "/dev/preview/employee-item-edit", "/dev/preview/employee-item-edit-trip", "/dev/preview/employee-item-edit-manual",
  "/dev/preview/admin-claims-detail", "/dev/preview/admin-claims-own", "/dev/preview/admin-payouts", "/dev/preview/employee-claim-detail", "/dev/preview/employee-claim-detail-rejected",
  "/dev/preview/employee-profile", "/dev/preview/employee-profile-new", "/dev/preview/employee-settlements", "/dev/preview/admin-approval-lines", "/dev/preview/approvals-inbox", "/dev/preview/approval-reviewer", "/dev/preview/admin-notifications", "/dev/preview/admin-billing", "/dev/preview/admin-billing-banner", "/dev/preview/admin-billing-empty", "/dev/preview/admin-export", "/dev/preview/admin-export-closed",
  "/dev/preview/app-admin-companies", "/dev/preview/app-admin-company", "/dev/preview/app-admin-receipt",
];
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
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    const res = await page.goto(base + p, { waitUntil: "networkidle" });
    if (!res || res.status() >= 400) {
      failures++;
      console.log(`FAIL ${p.padEnd(24)} ${v.name.padEnd(7)} HTTP ${res?.status()} (미리보기는 ENABLE_UI_PREVIEW=1로 서버를 띄워야 함)`);
      await ctx.close();
      continue;
    }
    // 오류 화면도 가로 넘침은 없으므로 따로 잡는다 (서버 오류 화면·스크립트 오류)
    const errorScreen = await page.evaluate(() => /This page couldn.t load|Application error|Internal Server Error/.test(document.body.innerText));
    if (errorScreen || pageErrors.length) {
      failures++;
      console.log(`FAIL ${p.padEnd(24)} ${v.name.padEnd(7)} 오류 화면 ${errorScreen ? "표시" : ""} ${pageErrors.slice(0, 2).join(" | ")}`);
      await ctx.close();
      continue;
    }
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
