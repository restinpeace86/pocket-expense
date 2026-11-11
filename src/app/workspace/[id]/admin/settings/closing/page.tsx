import { SettingsSectionPage } from "../section";

export const metadata = { title: "마감 일정 · WORKON" };

// 설정 › 경비 정책 › 마감 일정(D-251, D-161 고정 규칙 안내)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/closing">) {
  return <SettingsSectionPage title="마감 일정" params={params} show="closing" />;
}
