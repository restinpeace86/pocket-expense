import { TerminalScreen } from "@/components/attendance/terminal-screen";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `출근 단말 · ${BRAND.name}`, robots: { index: false } };

// 출근 단말 화면(spec/features/attendance.md §2-2, D-236): 회사 기기에 켜 두는 화면. 로그인 없이 단말 열쇠로만 동작
export default function TerminalPage() {
  return <TerminalScreen />;
}
