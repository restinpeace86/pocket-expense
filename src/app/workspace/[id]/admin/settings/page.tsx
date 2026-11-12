import { SettingsSectionPage } from "./section";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `회사정보 · ${BRAND.name}` };

// 설정 › 회사 기본정보 › 회사정보(D-251, spec/screens/admin-settings.md §1·§4)
export default function SettingsPage({ params }: PageProps<"/workspace/[id]/admin/settings">) {
  return <SettingsSectionPage title="회사정보" params={params} show={["company"]} />;
}
