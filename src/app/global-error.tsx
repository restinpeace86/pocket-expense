"use client";

import "./globals.css";
import { ErrorState } from "@/components/ui/error-state";

// 최상위 레이아웃에서 난 오류(7-15). 레이아웃을 대신하므로 html·body를 직접 그린다
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ErrorState error={error} retry={retry} />
      </body>
    </html>
  );
}
