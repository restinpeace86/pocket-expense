import { Suspense } from "react";
import { VisualAlertToggle } from "@/components/chat/visual-alert-toggle";
import { PushToggle } from "@/components/push/push-toggle";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { chatEnabled } from "@/lib/chat/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `이 기기 알림 · ${BRAND.name}` };

// 이 기기 알림(D-116 → D-251): 사람·기기마다 정하는 것이라 회사 설정 밖. 직원은 [내 정보]에 같은 칸이 있다
export default function DeviceAlertsPage({ params }: PageProps<"/workspace/[id]/admin/device-alerts">) {
  return (
    <>
      <SectionHeading as="h1" title="이 기기 알림" summary="지금 쓰는 이 휴대폰·PC에서 결재 요청·마감·채팅 알림을 받을지 정해요. 다른 기기는 그 기기에서 따로 켜요." />
      <PushToggle />
      <Suspense fallback={null}>
        <Visual params={params} />
      </Suspense>
    </>
  );
}

async function Visual({ params }: { params: PageProps<"/workspace/[id]/admin/device-alerts">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  return (await chatEnabled()) ? <VisualAlertToggle /> : null;
}
