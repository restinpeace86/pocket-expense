// [기본] 표시(U-3, D-309): 회사가 아무것도 바꾸지 않았을 때 쓰는 값. 모든 설정 선택지에서 같은 모양
// '추천'은 붙이지 않는다(무엇이 맞는지는 회사가 정함 — 기본값이라는 사실만 알림)
export function DefaultBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-300 bg-white px-1.5 text-[11px] font-semibold leading-4 text-zinc-600" data-default-badge>
      기본
    </span>
  );
}
