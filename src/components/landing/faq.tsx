import { ChevronDown } from "lucide-react";
import Link from "next/link";

// 랜딩 자주 묻는 질문(D-143, spec/screens/landing-page.md §7). 펼치기는 <details>라 자바스크립트 없이 동작한다.
// 답은 실제 정책과 같아야 한다 — 환불·이월은 이용약관 제7·9·10조, 가격은 요금제(D-133)와 함께 고친다.
const FAQS = [
  {
    q: "우리 회사 데이터가 다른 회사와 섞이지 않나요?",
    a: "회사마다 데이터가 완전히 분리되어 있어 다른 회사는 우리 회사의 영수증·결의서를 볼 수 없어요. 회사 안에서도 직원은 자기 내역만 보고, 회사 전체 내역은 관리자만 볼 수 있어요.",
  },
  {
    q: "세무사무소에는 무엇을 넘기면 되나요?",
    a: "월말 마감 화면에서 한 번에 내려받은 파일을 그대로 넘기면 돼요. 지출내역 엑셀(법인카드·개인 사비 시트 구분, 계정과목·계정코드·거래처 사업자등록번호 포함), 영수증 원본, 지출결의서 PDF가 함께 들어 있어요.",
  },
  {
    q: "직원은 어떻게 쓰나요? 앱을 깔아야 하나요?",
    a: "앱 설치는 필요 없어요. 관리자가 보낸 초대 링크로 카카오 또는 Google 계정으로 가입하고, 휴대폰에서 영수증을 찍어 올리면 끝이에요. 결의서는 AI가 채워 주고, 직원은 확인 후 결재만 올리면 돼요.",
  },
  {
    q: "무료 100장을 다 쓰면 어떻게 되나요?",
    a: "요금제(월 29,000원부터, VAT 별도)를 골라 이어서 쓸 수 있어요. 매달 제공되는 장수 중 남은 장수는 다음 달로 넘어가지 않고, 그달 장수를 다 쓰면 필요할 때만 50장을 8,000원에 추가할 수 있어요.",
  },
  {
    q: "해지와 환불은 어떻게 하나요?",
    a: "관리자가 [설정 › 요금제]에서 언제든 해지할 수 있고, 이미 결제한 기간이 끝날 때까지는 그대로 쓸 수 있어요. 결제 후 7일 안에 한 번도 쓰지 않았다면 전액 환불해 드리고, 그 밖의 경우는 이용약관의 환불 규정을 따라요.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-balance text-center text-3xl font-bold tracking-tight">
        자주 묻는 질문
      </h2>
      <ul className="mt-8 flex flex-col gap-3">
        {FAQS.map(({ q, a }) => (
          <li key={q}>
            <details className="group rounded-2xl border border-white/10 bg-white/5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                <span className="break-keep">{q}</span>
                <ChevronDown className="size-5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="break-keep px-5 pb-5 text-sm leading-relaxed text-zinc-300">{a}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-zinc-400">
        자세한 내용은{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-200">
          이용약관
        </Link>
        에서 확인할 수 있어요.
      </p>
    </section>
  );
}
