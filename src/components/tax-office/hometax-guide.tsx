import { ExternalLink } from "lucide-react";

// 홈택스에서 매달 매입 자료 내려받는 방법(D-315). 홈택스 메뉴 이름은 개편마다 바뀌어서 '위 검색창에 넣을 말'로 안내한다
const ITEMS = [
  { kind: "전자세금계산서(매입)", search: "세금계산서 목록조회", how: "[매입]을 고르고" },
  { kind: "현금영수증(매입)", search: "현금영수증 매입내역", how: "" },
  { kind: "사업용 신용카드(매입)", search: "사업용 신용카드 사용내역", how: "", note: "홈택스에 사업용 카드를 등록한 경우에만 나와요" },
];

export function HometaxGuide({ month, open = false }: { month: string; open?: boolean }) {
  const m = Number(month.slice(5, 7));
  return (
    <details open={open} className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-zinc-800" data-hometax-guide>
      <summary className="cursor-pointer font-semibold text-blue-900">홈택스에서 {m}월 자료 내려받는 방법 (약 5분)</summary>
      <ol className="mt-2 flex flex-col gap-2 break-keep">
        <li>
          <b>1.</b> 홈택스에 <b>사업자로 로그인</b>해요(공동인증서·간편인증).{" "}
          <a href="https://hometax.go.kr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-blue-700 underline underline-offset-2">
            홈택스 열기
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </li>
        <li>
          <b>2.</b> 화면 위 <b>검색창</b>에 아래 말을 넣으면 그 메뉴가 바로 나와요. 기간을 <b>{m}월 1일 ~ 말일</b>로 하고 [조회] → <b>엑셀 내려받기</b>.
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {ITEMS.map((it) => (
              <li key={it.kind} className="rounded-md bg-white px-2.5 py-2">
                <span className="font-medium">{it.kind}</span>
                <span className="block text-zinc-700">
                  검색: <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-sans text-xs">{it.search}</kbd>
                  {it.how && ` → ${it.how}`}
                </span>
                {it.note && <span className="block text-xs text-zinc-500">{it.note}</span>}
              </li>
            ))}
          </ul>
        </li>
        <li>
          <b>3.</b> 받은 파일을 <b>고치지 말고 그대로</b> 아래에 올리고 자료 종류만 골라요. 세무사무소가 앱에서 바로 보고 받아요.
        </li>
      </ol>
      <p className="mt-2 break-keep text-xs text-zinc-500">
        홈택스 메뉴 이름은 개편 때마다 조금씩 바뀌어요. 검색으로 안 나오면 &lsquo;조회/발급&rsquo; 메뉴에서 찾거나 국세청 상담센터(126)에 물어보세요. 세무사무소가 홈택스 수임으로 직접 받는다면 이 단계는 건너뛰어도 돼요.
      </p>
    </details>
  );
}
