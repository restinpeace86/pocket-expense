import Image from "next/image";

// 직원별 연차 위 [연차는 법에서 이렇게 정해요](D-240, attendance.md §7-1)
// 사용자 원칙: 법 기준을 숨기지 않고 조항·쉬운 말·예시로 보여 준다. 그림은 승인된 시안(로고·서비스 이름 없음, "예시 회사")
const LAW: { law: string; when: string; easy: React.ReactNode; example: string }[] = [
  { law: "제60조 ①", when: "1년간 80% 이상 출근", easy: <>1년을 다 채우면 <b>15일</b></>, example: "2025-03-02 입사 → 2026-03-02에 15일" },
  { law: "제60조 ②", when: "1년 미만(또는 80% 미만 출근)", easy: <><b>1개월 개근할 때마다 1일</b>, 최대 11일</>, example: "4/1 입사 → 5/1에 1일, 6/1에 1일 …" },
  { law: "제60조 ④", when: "3년 이상 계속 근무", easy: <>첫 1년 뒤 <b>2년마다 1일 더</b>, 최대 <b>25일</b></>, example: "근속 3년 16일 · 5년 17일 · 21년 25일" },
  { law: "제60조 ⑥", when: "출근한 것으로 보는 기간", easy: <>일하다 다쳐 쉰 기간, 출산전후휴가, 육아휴직 등은 <b>출근한 날로 쳐요</b></>, example: "육아휴직 기간을 출근율에서 빼지 않음" },
  { law: "제60조 ⑦", when: "쓸 수 있는 기간", easy: <>생긴 날부터 <b>1년 안에</b> 써야 해요. 안 쓰면 없어지고, 회사가 사용 촉진을 안 했으면 수당으로 줘야 해요</>, example: "" },
  { law: "2021 대법원·노동부 해석", when: "생기는 날", easy: <>1년(또는 1개월) 근무를 <b>마친 다음 날</b> 생겨요</>, example: "1년 계약 뒤 바로 퇴사 → 15일은 생기지 않음" },
  { law: "시행령 별표1", when: "상시 5명 미만 회사", easy: <>제60조가 <b>적용되지 않아요</b> → 회사가 자율로 정해요</>, example: "" },
];

const IMAGES = [
  { img: "join-hire.png", title: "직원은 가입할 때 입사일을 넣어요", body: "카카오·구글로 로그인한 뒤 회사 가입 화면에서 넣어요. 가입한 뒤에는 본인이 못 바꾸고, 틀렸으면 관리자가 사유를 적고 고쳐요(직원에게 알림)." },
  { img: "leave-edit.png", title: "법 기준보다 적게 정하면 경고", body: "막지는 않지만 사유를 꼭 적어야 해요. 출근율이 80% 미만인 경우처럼 사유가 있을 때만 적게 정해 주세요." },
];

export function LeaveLawGuide() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-zinc-700">
        앱은 아래 <b>근로기준법 제60조</b> 기준으로 직원마다 <b>추천 일수를 계산</b>해 보여 줘요. 최종 일수는 <b>회사가 확정</b>해요. 직원 줄을 누르면 &quot;왜 이 일수인지&quot; 계산 과정과 조항이 나와요.
      </p>
      {/* 휴대폰: 조항마다 카드 / PC: 표 */}
      <ul className="flex flex-col gap-2 md:hidden">
        {LAW.map((r) => (
          <li key={r.law} className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed">
            <b className="text-brand-700">{r.law}</b> <span className="text-zinc-600">· {r.when}</span>
            <span className="block text-zinc-900">{r.easy}</span>
            {r.example && <span className="block text-zinc-600">예: {r.example}</span>}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">근거</th>
              <th className="px-3 py-2 font-medium">언제</th>
              <th className="px-3 py-2 font-medium">쉬운 말</th>
              <th className="px-3 py-2 font-medium">예시</th>
            </tr>
          </thead>
          <tbody>
            {LAW.map((r) => (
              <tr key={r.law} className="border-t border-zinc-100 align-top">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-brand-700">{r.law}</td>
                <td className="px-3 py-2.5 text-zinc-700">{r.when}</td>
                <td className="px-3 py-2.5">{r.easy}</td>
                <td className="px-3 py-2.5 text-zinc-600">{r.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-950">
          <b>연도 기준 두 가지</b>(근태 설정에서 골라요)
          <br />· <b>1월 1일~12월 31일(회계연도)</b>: 입사한 다음 해 1월 1일에 근무한 날만큼 나눠서 줘요(15일 × 재직일수 ÷ 365). 그 뒤로는 매년 1월 1일에 줘요. 단, <b>입사일 기준으로 계산한 것보다 적게 주면 안 돼요</b>.
          <br />· <b>직원별 입사일</b>: 입사한 날을 기준으로 1년씩 계산해요. 법 조문 그대로예요.
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] leading-relaxed text-orange-950">
          <b>앱이 하지 않는 것</b>
          <br />· 출근율 80%·개근 여부 판단(출퇴근 기록은 참고로만 보여 줘요)
          <br />· 연차수당·퇴사 정산 · 연차 사용 촉진 통지
          <br />· 대표(사업주)는 근로자가 아니어서 법 연차 대상이 아니에요 — 직접 정해요
          <br />애매하면 고용노동부 상담 <b>1350</b>이나 노무사에게 확인해 주세요.
        </div>
      </div>
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {IMAGES.map((s) => (
          <li key={s.img} className="flex flex-col gap-2">
            <a href={`/guide/attendance/${s.img}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <Image src={`/guide/attendance/${s.img}`} width={390} height={844} alt={`예시 화면: ${s.title}`} className="aspect-[390/600] w-full object-cover object-bottom" sizes="(min-width: 640px) 33vw, 50vw" />
            </a>
            <b className="text-sm text-zinc-900">{s.title}</b>
            <span className="text-[13px] leading-relaxed text-zinc-600">{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
