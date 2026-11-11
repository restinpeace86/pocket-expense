import { SettingsSectionPage } from "../section";

export const metadata = { title: "출장 일비 · Moa-on" };

// 설정 › 경비 정책 › 출장 일비(D-251)
export default function Page({ params }: PageProps<"/workspace/[id]/admin/settings/per-diem">) {
  return <SettingsSectionPage title="출장 일비" params={params} show={["perDiem"]} />;
}
