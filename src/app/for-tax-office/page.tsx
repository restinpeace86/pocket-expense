import { OfficeIntro } from "@/components/tax-office/office-intro";

export const metadata = { title: "세무사무소 · PocketExpense", description: "고객사 지출 장부·영수증·지출결의서·홈택스 자료를 한곳에서 받는 무료 세무사무소 워크스페이스" };

// 세무사무소 소개 (D-173) — 랜딩 푸터 [세무사무소]
export default function ForTaxOfficePage() {
  return <OfficeIntro startHref="/login?next=%2Ftax-office" />;
}
