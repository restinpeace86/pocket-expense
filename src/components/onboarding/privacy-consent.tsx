// 개인정보 수집·이용 동의 (필수, D-025)
export function PrivacyConsent() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
      <p className="font-medium text-zinc-900">개인정보 수집·이용 안내</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>수집 항목: 이름, 휴대폰 번호, 부서, 직급·사번·차량번호(입력 시), 정산 계좌(입력 시), 로그인 계정 이메일</li>
        <li>이용 목적: 경비 청구·결재·정산 처리, 카카오 알림톡 결재 알림 발송</li>
        <li>보유 기간: 회사의 서비스 이용 종료 시까지. 세무 증빙 등 법령상 보관 의무가 있는 기록은 해당 기간까지</li>
      </ul>
      <label className="mt-1 flex min-h-11 items-center gap-2">
        <input type="checkbox" name="privacy" required className="size-5 accent-blue-600" />
        <span className="font-medium text-zinc-900">위 내용에 동의합니다 (필수)</span>
      </label>
    </div>
  );
}
