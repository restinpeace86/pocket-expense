import { SettingsSectionPage } from "../section";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `자차 유류비 · ${BRAND.name}` };

// 설정 › 경비 정책 › 자차 유류비(D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/fuel">) {
  return <SettingsSectionPage title="자차 유류비" params={params} show={["fuel"]} />;
}
