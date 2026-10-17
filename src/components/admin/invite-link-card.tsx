"use client";

import { Check, Copy, Download, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { regenerateInviteCodeAction } from "@/app/workspace/[id]/admin/actions";

const noop = () => () => {};

// 공용 초대 링크·QR (spec/screens/admin-team-members.md §4.A). 직원은 이 링크로 가입 신청 → 승인 대기
export function InviteLinkCard({ inviteCode, companyName, preview = false }: { inviteCode: string; companyName: string; preview?: boolean }) {
  // 서버 렌더에서는 배포 주소, 브라우저에서는 실제 접속 주소(로컬·프리뷰 배포 포함)
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => process.env.NEXT_PUBLIC_SITE_URL ?? "",
  );
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const link = `${origin.replace(/\/$/, "")}/join/${inviteCode}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
    }
  }

  function regenerate() {
    if (preview) return;
    if (!confirm("초대 링크를 새로 만들까요? 이전 링크와 QR은 바로 사용할 수 없게 됩니다.")) return;
    setError(null);
    startTransition(async () => {
      const r = await regenerateInviteCodeAction();
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">직원 초대 링크</h2>
      <p className="mt-1 text-sm text-zinc-600">
        이 링크를 단톡방이나 개인 톡으로 보내 주세요. 직원이 링크로 가입 신청하면 아래 [가입 승인 대기]에서 승인합니다.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-800" title={link}>
              {link}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 sm:flex-none">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "복사됐어요" : "링크 복사"}
            </button>
            {qr && (
              <a
                href={qr}
                download={`${companyName}_초대QR.png`}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 sm:flex-none"
              >
                <Download className="size-4" /> QR 이미지 저장
              </a>
            )}
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> 새 링크 만들기
            </button>
          </div>
          <p className="text-xs text-zinc-500">초대 코드: <span className="font-mono">{inviteCode}</span></p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-center sm:block">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL QR 이미지
            <img src={qr} alt={`${companyName} 초대 QR 코드`} width={160} height={160} className="size-40 rounded-xl border border-zinc-200" />
          ) : (
            <div className="size-40 animate-pulse rounded-xl bg-zinc-100" />
          )}
        </div>
      </div>
    </section>
  );
}
