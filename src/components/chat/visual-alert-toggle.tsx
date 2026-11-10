"use client";

import { useEffect, useState, useTransition } from "react";
import { saveVisualAlertAction } from "@/app/workspace/theme-actions";
import { VISUAL_ALERT_EVENT } from "@/lib/chat/visual-alert";
import { createClient } from "@/lib/supabase/client";

// PC 화면 알림 켜기/끄기(D-246): [내 정보] 카드(직원)·채팅 목록 위 설정(관리자). 계정에 저장, 바꾸면 열린 화면에 바로 반영
export function VisualAlertToggle({ compact = false }: { compact?: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  useEffect(() => {
    void createClient()
      .rpc("my_membership")
      .then(({ data }) => setOn((data as { chat_visual_alert?: boolean } | null)?.chat_visual_alert !== false));
  }, []);
  const flip = () => {
    if (on === null) return;
    const next = !on;
    setOn(next);
    setError(false);
    window.dispatchEvent(new CustomEvent(VISUAL_ALERT_EVENT, { detail: next }));
    start(async () => {
      const r = await saveVisualAlertAction(next);
      if (r.error) {
        setOn(!next);
        setError(true);
        window.dispatchEvent(new CustomEvent(VISUAL_ALERT_EVENT, { detail: !next }));
      }
    });
  };
  const body = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p id="visual-alert-title" className={compact ? "text-sm font-semibold" : "font-semibold"}>
          PC 화면 알림
        </p>
        <p className="mt-0.5 break-keep text-[13px] text-zinc-600">새 메시지가 오면 소리 없이 오른쪽 아래 작은 알림과 화면 가장자리 파란빛(짧게 2번)으로 알려요. PC에서만 보여요.</p>
        {error && (
          <p role="alert" className="mt-1 text-xs font-semibold text-red-700">
            저장하지 못했어요. 다시 눌러 주세요.
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on === true}
        aria-labelledby="visual-alert-title"
        disabled={on === null || busy}
        onClick={flip}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brand-600" : "bg-zinc-300"}`}
        data-visual-alert-switch
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
  if (compact) return <div className="border-t border-zinc-100 pt-3">{body}</div>;
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4">{body}</section>;
}
