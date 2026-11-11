import { SettingsSectionPage } from "../section";

export const metadata = { title: "자차 유류비 · Moa-on" };

// 설정 › 경비 정책 › 자차 유류비(D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/fuel">) {
  return <SettingsSectionPage title="자차 유류비" params={params} show={["fuel"]} />;
}
