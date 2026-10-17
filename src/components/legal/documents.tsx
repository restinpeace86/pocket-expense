import type { ReactNode } from "react";

// 이용약관 · 개인정보 문서 (초안). 정식 오픈 전 전문가 검토 후 본문을 보완한다 (D-059, O-07).
// 버전을 바꾸면 private.app_settings의 terms_version / privacy_version도 함께 바꾼다.
export const LEGAL_VERSION = "draft-2026-10-17";

function DraftNotice() {
  return (
    <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
      초안입니다. 정식 서비스 오픈 전에 내용이 보완될 수 있습니다. (버전 {LEGAL_VERSION})
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-semibold text-zinc-900">{title}</h3>
      <div className="flex flex-col gap-1 text-sm leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}

export function TermsContent() {
  return (
    <div className="flex flex-col gap-5">
      <DraftNotice />
      <Section title="제1조 (목적)">
        <p>이 약관은 PocketExpense(이하 &ldquo;서비스&rdquo;)가 제공하는 경비 청구·결재·정산 서비스의 이용 조건과 절차, 이용자와 서비스의 권리·의무를 정합니다.</p>
      </Section>
      <Section title="제2조 (이용 계약)">
        <p>회사(고객사)의 관리자는 회사 정보를 등록해 서비스 이용을 신청하며, 직원은 회사가 제공한 초대 링크로 가입합니다.</p>
      </Section>
      <Section title="제3조 (요금)">
        <p>현재는 한시적 무료 제공 기간이며, 유료 요금제와 결제 조건은 별도로 안내합니다.</p>
      </Section>
      <Section title="제4조 (이용자의 의무)">
        <p>이용자는 사실과 다른 경비 청구, 타인의 영수증 사용 등 부정한 목적으로 서비스를 이용해서는 안 됩니다.</p>
      </Section>
      <Section title="제5조 (기타)">
        <p>그 밖의 사항은 정식 약관에서 정합니다.</p>
      </Section>
    </div>
  );
}

export function PrivacyContent() {
  return (
    <div className="flex flex-col gap-5">
      <DraftNotice />
      <Section title="1. 수집·이용 목적">
        <p>경비 청구·결재·정산 처리, 카카오 알림톡 결재 알림 발송, 회사 내 멤버 관리</p>
      </Section>
      <Section title="2. 수집 항목 (필수)">
        <p>이름, 휴대폰 번호, 부서, 로그인 계정 정보(카카오·Google 이메일), 직급·사번(입력 시), 경비 청구 내역과 영수증 이미지</p>
      </Section>
      <Section title="3. 보유·이용 기간">
        <p>회사의 서비스 이용 종료 시까지. 세무 증빙 등 법령상 보관 의무가 있는 기록은 해당 법령이 정한 기간까지 보관합니다.</p>
      </Section>
      <Section title="4. 동의를 거부할 권리와 불이익">
        <p>개인정보 수집·이용 동의를 거부할 수 있습니다. 다만 필수 항목에 동의하지 않으면 서비스에 가입하거나 경비를 청구할 수 없습니다.</p>
      </Section>
      <Section title="5. 처리 위탁 및 국외 이전">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase(데이터·파일 보관) — 일본</li>
          <li>Vercel(서비스 서버) — 일본</li>
          <li>Google Gemini(영수증 문자 인식) — 미국</li>
          <li>카카오 알림톡 발송대행사 — 대한민국(업체 선정 후 안내)</li>
        </ul>
        <p>이전 항목·시기·방법·보유 기간 등 상세 내용은 개인정보 처리방침에서 안내합니다.</p>
      </Section>
    </div>
  );
}

export function OptionalPrivacyContent() {
  return (
    <div className="flex flex-col gap-5">
      <DraftNotice />
      <Section title="1. 수집·이용 목적">
        <p>개인카드로 쓴 경비의 정산금 지급(정산 계좌), 자차 출장비 증빙(차량번호)</p>
      </Section>
      <Section title="2. 수집 항목 (선택)">
        <p>은행명, 계좌번호, 예금주, 차량번호</p>
      </Section>
      <Section title="3. 보유·이용 기간">
        <p>회사의 서비스 이용 종료 또는 본인이 삭제할 때까지</p>
      </Section>
      <Section title="4. 동의를 거부할 권리와 불이익">
        <p>동의하지 않아도 가입과 경비 청구는 할 수 있습니다. 정산 계좌가 없으면 정산금 지급을 위해 회사에 별도로 계좌를 알려야 할 수 있습니다.</p>
      </Section>
    </div>
  );
}
