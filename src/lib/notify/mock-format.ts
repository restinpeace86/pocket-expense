import { maskPhone, TEMPLATE_LABEL, type TemplateCode } from "./templates";

// 알림톡 Mock(로그 드라이버) 콘솔 출력 모양 — 7차 개선사항 4
// 실제로 보내지 않고, 카카오톡에 뜰 내용을 템플릿 종류별로 상자 모양으로 찍는다(받는 번호는 가림).
export type MockMessage = { to: string; template: string; text: string; buttonLabel: string; buttonUrl: string; vars?: Record<string, string> };

export function formatMockAlimtalk(m: MockMessage, templateId: string | null): string {
  const label = TEMPLATE_LABEL[m.template as TemplateCode] ?? m.template;
  const bar = "─".repeat(44);
  const out = [
    `┌${bar}`,
    `│ 📨 알림톡 [MOCK] ${label}`,
    `│ 템플릿: ${m.template} · 템플릿 ID: ${templateId ?? "(미등록)"}`,
    `│ 받는 사람: ${maskPhone(m.to)}`,
    `├${bar}`,
    ...m.text.split("\n").map((l) => `│ ${l}`),
    `│ [${m.buttonLabel}] ${m.buttonUrl}`,
  ];
  if (m.vars && Object.keys(m.vars).length) {
    out.push(`├${bar}`, "│ 변수(실제 발송 시 템플릿에 채움)");
    for (const [k, v] of Object.entries(m.vars)) out.push(`│   #{${k}} = ${v}`);
  }
  out.push(`└${bar} 결과: 성공(Mock — 실제 발송 없음)`);
  return out.join("\n");
}
