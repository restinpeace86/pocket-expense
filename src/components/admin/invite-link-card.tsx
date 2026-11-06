"use client";

import { Check, Copy, Download, RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { regenerateInviteCodeAction } from "@/app/workspace/[id]/admin/actions";
import { SectionHeading } from "@/components/ui/help";
import { configuredSiteUrl, publicOrigin } from "@/lib/site-url";
import { KakaoShareButton } from "./kakao-share-button";
import { installGuideUrl } from "@/lib/invite-share";

const noop = () => () => {};

// 앱 설치 안내 QR(D-229): 사무실에 붙여 두기 좋게 제목·설명을 넣은 한 장짜리 이미지(PNG)
async function installQrImage(url: string, companyName: string): Promise<string> {
  const qr = await QRCode.toDataURL(url, { width: 520, margin: 1, errorCorrectionLevel: "M" });
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("qr"));
    img.src = qr;
  });
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 900;
  const g = c.getContext("2d");
  if (!g) return qr;
  const font = "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  // 폭(580px)을 넘으면 글자를 줄여서 한 줄에 맞춘다(긴 회사 이름)
  const fit = (text: string, weight: number, size: number, y: number) => {
    let px = size;
    g.font = `${weight} ${px}px ${font}`;
    while (px > 14 && g.measureText(text).width > 580) g.font = `${weight} ${--px}px ${font}`;
    g.fillText(text, 320, y);
  };
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#4f46e5";
  g.fillRect(0, 0, c.width, 12);
  g.textAlign = "center";
  g.fillStyle = "#1e1b4b";
  fit("WORKON 앱 설치 안내", 800, 40, 84);
  g.fillStyle = "#3f3f46";
  fit(`${companyName} 직원용`, 700, 26, 128);
  g.fillStyle = "#52525b";
  fit("휴대폰 카메라로 찍어 주세요", 500, 22, 162);
  g.drawImage(img, 60, 190, 520, 520);
  g.fillStyle = "#1e1b4b";
  fit("안드로이드 = 설치 앱  ·  아이폰 = 홈 화면 추가", 700, 24, 768);
  g.fillStyle = "#52525b";
  fit("열린 화면에서 가입 신청 → 앱(아이콘)에서 로그인", 400, 21, 810);
  fit("PC는 웹 그대로 쓰면 돼요", 400, 21, 844);
  return c.toDataURL("image/png");
}

// 공용 초대 링크·QR (spec/screens/admin-team-members.md §4.A). 직원은 이 링크로 가입 신청 → 승인 대기
// compact: 멤버 관리·설정·직원이 생긴 뒤의 홈. 모바일에서 아래 내용이 밀리지 않도록 QR 미리보기는 태블릿 이상에서만 보인다.
export function InviteLinkCard({
  inviteCode,
  companyName,
  preview = false,
  compact = false,
}: {
  inviteCode: string;
  companyName: string;
  preview?: boolean;
  compact?: boolean;
}) {
  // 서버 렌더에서는 배포 주소, 브라우저에서는 접속 주소(로컬에서 열었으면 배포 주소 — 카톡으로 보낸 링크가 localhost가 되지 않게, D-099)
  const origin = useSyncExternalStore(noop, () => publicOrigin(), configuredSiteUrl);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const link = `${origin.replace(/\/$/, "")}/join/${inviteCode}`;
  const installLink = installGuideUrl(origin, inviteCode);
  const [installQr, setInstallQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  useEffect(() => {
    let alive = true;
    installQrImage(installLink, companyName)
      .then((url) => alive && setInstallQr(url))
      .catch(() => alive && setInstallQr(null));
    return () => {
      alive = false;
    };
  }, [installLink, companyName]);

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
    if (
      !confirm(
        "초대 링크를 새로 만들까요? 이전 링크와 QR은 바로 사용할 수 없게 됩니다.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await regenerateInviteCodeAction();
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <SectionHeading
        title="직원 초대 링크"
        summary="직원에게 이 링크만 보내면 돼요. 코드를 따로 알려 줄 필요는 없어요."
        helpId="admin.invite"
        helpLabel="직원 초대는 이렇게 해요"
        help={
          <>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              <li>
                <b>[카카오톡으로 공유하기]</b>로 바로 보내거나, <b>[링크 복사]</b>를 눌러 단톡방·개인 톡에 붙여 넣으세요. 사무실에 붙여 둘 땐 <b>[QR 이미지 저장]</b>이 편해요.
              </li>
              <li>
                카카오톡 메시지에는 <b>[웹으로 가입하기]</b>와 <b>[앱 설치 안내]</b>가 같이 가요. 직원이 휴대폰에 맞게 고르면 돼요 — 안드로이드는 알림이 확실한 설치 앱, 아이폰은 Safari 홈 화면 추가.
                사무실에 붙여 둘 앱 안내는 <b>[앱 설치 QR 저장]</b>으로 받으세요(찍으면 가입·설치 안내가 함께 열려요).
              </li>
              <li>직원이 링크를 열어 로그인하고 이름·연락처를 입력하면 &lsquo;가입 승인 대기&rsquo;로 들어와요.</li>
              <li>
                <b>멤버 관리</b>에서 우리 직원이 맞는지 확인하고 <b>[승인]</b>을 누르면 바로 경비를 올릴 수 있어요.
              </li>
            </ol>
            <p className="text-zinc-500">
              링크로 들어온 직원은 우리 회사에만 소속되고, 다른 회사 정보는 서로 볼 수 없어요. 링크가 외부로 퍼졌다면 <b>[새 링크 만들기]</b>를 누르세요.
              이전 링크와 QR은 바로 막혀요.
            </p>
          </>
        }
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span
              className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-800"
              title={link}
            >
              {link}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:flex-none"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "복사됐어요" : "링크 복사"}
            </button>
            <KakaoShareButton link={link} installLink={installLink} companyName={companyName} />
            {qr && (
              <a
                href={qr}
                download={`${companyName}_초대QR.png`}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 sm:flex-none"
              >
                <Download className="size-4" /> QR 이미지 저장
              </a>
            )}
            {installQr && (
              <a
                href={installQr}
                download={`${companyName}_앱설치QR.png`}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-brand-600 bg-white px-4 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:flex-none"
              >
                <Smartphone className="size-4" /> 앱 설치 QR 저장
              </a>
            )}
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${pending ? "animate-spin" : ""}`}
              />{" "}
              새 링크 만들기
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            초대 코드: <span className="font-mono">{inviteCode}</span>
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        <div
          className={
            compact ? "hidden sm:block" : "flex justify-center sm:block"
          }
        >
          <div className="flex gap-3">
            <figure className="flex flex-col items-center gap-1">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL QR 이미지
                <img
                  src={qr}
                  alt={`${companyName} 초대 QR 코드`}
                  width={160}
                  height={160}
                  className="size-40 rounded-xl border border-zinc-200"
                />
              ) : (
                <div className="size-40 animate-pulse rounded-xl bg-zinc-100" />
              )}
              <figcaption className="text-xs text-zinc-500">가입 QR</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1">
              {installQr ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL QR 이미지
                <img
                  src={installQr}
                  alt={`${companyName} 앱 설치 안내 QR 이미지`}
                  width={114}
                  height={160}
                  className="h-40 w-[7.1rem] rounded-xl border border-zinc-200 object-contain"
                />
              ) : (
                <div className="h-40 w-[7.1rem] animate-pulse rounded-xl bg-zinc-100" />
              )}
              <figcaption className="text-xs text-zinc-500">앱 설치 QR</figcaption>
            </figure>
          </div>
        </div>
      </div>

    </section>
  );
}
