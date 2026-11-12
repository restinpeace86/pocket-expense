// 아이폰 설치 앱 아이콘·시작 화면 만들기(D-259). 웹 아이콘(src/app/icons/[size]/route.tsx)과 같은 모양.
// App Store 아이콘은 1024×1024, 투명(알파) 없는 PNG여야 한다. 시작 화면은 흰 바탕 가운데 아이콘.
// 실행: node scripts/ios-assets.mjs  (sharp는 Next.js가 이미 씀)
import sharp from "sharp";

const ASSETS = "mobile/ios/App/App/Assets.xcassets";
const mark = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#312e81"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g transform="translate(${size * 0.22} ${size * 0.22}) scale(${(size * 0.56) / 44})">
    <path d="M8 34V14l14 12 14-12v20" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="22" cy="8" r="4" fill="white"/>
  </g>
</svg>`;

// 앱 아이콘 1024(알파 없음)
await sharp(Buffer.from(mark(1024))).flatten({ background: "#4f46e5" }).removeAlpha().png().toFile(`${ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`);

// 시작 화면 2732(흰 바탕 + 가운데 둥근 아이콘 360)
const icon = await sharp(Buffer.from(mark(360)))
  .composite([{ input: Buffer.from(`<svg width="360" height="360"><rect width="360" height="360" rx="80" fill="#fff"/></svg>`), blend: "dest-in" }])
  .png()
  .toBuffer();
const splash = await sharp({ create: { width: 2732, height: 2732, channels: 3, background: "#ffffff" } })
  .composite([{ input: icon, gravity: "center" }])
  .flatten({ background: "#ffffff" })
  .png()
  .toBuffer();
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) await sharp(splash).toFile(`${ASSETS}/Splash.imageset/${f}`);
console.log("ios assets ok");
