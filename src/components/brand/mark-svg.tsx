import { BRAND } from "@/lib/brand";

// 로고 표시 그림 하나(9-14a). 화면 로고(logo.tsx)와 서버 이미지(탭 아이콘·앱 아이콘·공유 이미지)가 같이 쓴다.
// 서버 이미지 생성기(next/og)에서도 그려지도록 hook·className 없이 svg만 돌려준다.
export function markSvg({ size, color, weight = 1 }: { size: number | string; color: string; weight?: number }) {
  const m = BRAND.mark;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${m.viewBox} ${m.viewBox}`}>
      <path d={m.path} fill="none" stroke={color} strokeWidth={m.stroke * weight} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={m.dot.cx} cy={m.dot.cy} r={m.dot.r * weight} fill={color} />
    </svg>
  );
}
