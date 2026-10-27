"use client";

import { ErrorState } from "@/components/ui/error-state";

// 워크스페이스 안의 예상 못 한 오류(7-15): 메뉴는 그대로 두고 본문만 안내
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} area="admin" />;
}
