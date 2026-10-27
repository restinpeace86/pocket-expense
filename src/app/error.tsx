"use client";

import { ErrorState } from "@/components/ui/error-state";

// 예상 못 한 오류(7-15): 기본 영문 화면 대신 한국어 안내 + 다시 시도
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} />;
}
