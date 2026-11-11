import { SettingsSectionPage } from "../section";

export const metadata = { title: "식대 한도 · WORKON" };

// 설정 › 경비 정책 › 식대 한도(D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/meal">) {
  return <SettingsSectionPage title="식대 한도" params={params} show={["meal"]} />;
}
