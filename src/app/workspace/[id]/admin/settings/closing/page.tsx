import { SettingsSectionPage } from "../section";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `마감 일정 · ${BRAND.name}` };

// 설정 › 경비 정책 › 마감 일정(D-251, D-161 고정 규칙 안내)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/closing">) {
  return <SettingsSectionPage title="마감 일정" params={params} show="closing" />;
}
