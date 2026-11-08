import Image from "next/image";

// 근태 설정 위 [근태는 이렇게 동작해요](D-236, attendance.md §1 사용 안내): 단계 설명 + 예시 화면 그림
// 그림은 승인된 시안 캔버스에서 만든 것(서비스 로고·이름 없음, 회사명 "예시 회사") — public/guide/attendance/
const STEPS: { img: string; w: number; h: number; title: string; body: string; bottom?: boolean }[] = [
  { img: "terminal.png", w: 1180, h: 820, title: "1. 회사 기기에 QR 띄우기", body: "입구 PC·태블릿을 출근 단말로 연결하면 30초마다 바뀌는 QR이 떠요. 사진을 찍어 보내도 1분 뒤엔 쓸 수 없어요." },
  { img: "scan.png", w: 390, h: 844, title: "2. 직원이 휴대폰으로 찍기", body: "앱 가운데 [QR 출퇴근] 버튼이나 휴대폰 기본 카메라로 찍어요. 시각은 휴대폰이 아니라 서버 시간이에요." },
  { img: "in.png", w: 390, h: 844, title: "3. 처음 찍으면 출근", body: "출근 시각이 바로 기록되고, 출근 단말 화면에도 \"OOO 출근\"이 잠깐 떠요." },
  { img: "out-confirm.png", w: 390, h: 844, bottom: true, title: "4. 다시 찍으면 퇴근", body: "\"퇴근할까요?\"를 한 번 확인하고 퇴근이 기록돼요. 하루 출근 1번·퇴근 1번만이에요." },
  { img: "already.png", w: 390, h: 844, title: "5. 잘못 찍었으면 정정 신청", body: "일찍 찍었거나 퇴근 뒤 더 일했다면 직원이 정정 신청을 올리고 관리자가 승인해요. (정정 신청 화면은 곧 열려요)" },
  { img: "notice.png", w: 390, h: 844, title: "6. 퇴근을 잊으면 알림", body: "정규 퇴근 뒤 정한 시간이 지나도 퇴근을 안 찍었으면 본인 채팅 [알림]방과 휴대폰으로 알려요." },
];

export function AttendanceGuide() {
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.img} className={`flex flex-col gap-2 ${s.w > s.h ? "col-span-2 sm:col-span-3" : ""}`}>
            <a href={`/guide/attendance/${s.img}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <Image
                src={`/guide/attendance/${s.img}`}
                width={s.w}
                height={s.h}
                alt={`예시 화면: ${s.title}`}
                className={`w-full ${s.w > s.h ? "max-h-80 object-contain" : `aspect-[390/600] object-cover ${s.bottom ? "object-bottom" : "object-top"}`}`}
                sizes="(min-width: 640px) 33vw, 50vw"
              />
            </a>
            <b className="text-sm text-zinc-900">{s.title}</b>
            <span className="text-[13px] leading-relaxed text-zinc-600">{s.body}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] leading-relaxed text-orange-950">
        <b>꼭 알아 두세요</b>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            퇴근은 그날 자정 전에 찍어야 해요. <b>자정 넘은 퇴근은 지원하지 않아요.</b> 자정까지 안 찍으면 정규 퇴근 시각으로 자동 기록돼요(정정 신청으로 고칠 수 있어요).
          </li>
          <li>QR은 06:00~24:00에만 떠요. 06시 전에 시작하는 새벽 근무는 지원하지 않아요.</li>
          <li>근무 요일이 아닌 날·공휴일에 찍으면 &quot;휴일&quot;로 남고, 관리자가 휴일 근무를 승인해야 근무한 날로 인정돼요(휴일 근무 상신·승인 화면은 곧 열려요).</li>
          <li>지각·조퇴 집계, 연장·야간·휴일 수당 계산은 하지 않아요. 찍힌 시각과 머문 시간만 보여 줘요.</li>
          <li>설정·출근 단말을 바꾸면 누가·언제·무엇을 바꿨는지 [변경 이력]에 남고, 지울 수 없어요.</li>
        </ul>
      </div>
    </div>
  );
}
