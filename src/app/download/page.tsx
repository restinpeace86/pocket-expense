import Link from "next/link";
import { Suspense } from "react";
import { JoinStep } from "./join-step";
import { ApkButton } from "./apk-button";
import QRCode from "qrcode";
import { Check, Smartphone } from "lucide-react";
import { Card, PageShell } from "@/components/ui/page-shell";
import { ANDROID_APP_BENEFITS, ANDROID_APP_VERSION, androidApkUrl } from "@/lib/app-download";
import { siteOrigin } from "@/lib/seo";

// 앱 받기(D-228): 안드로이드 = 설치 앱(APK) 또는 홈 화면 웹앱 중 고르기, 아이폰 = 홈 화면 웹앱. PC = 휴대폰으로 찍을 QR
export const metadata = { title: "앱 받기 · Moa-on", description: "Moa-on을 휴대폰에서 앱처럼 쓰고 알림 받기" };

export default async function DownloadPage() {
  const apk = androidApkUrl();
  const here = `${siteOrigin()}/download`;
  const qr = await QRCode.toString(here, { type: "svg", margin: 1, width: 200, errorCorrectionLevel: "M" }).catch(() => null);
  return (
    <PageShell>
      <div className="pt-6">
        <Link href="/" className="text-sm text-zinc-500 underline underline-offset-2">
          Moa-on
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">휴대폰에서 Moa-on 쓰기</h1>
        <p className="mt-1 text-sm text-zinc-600">결재·채팅 알림을 휴대폰으로 바로 받아요.</p>
      </div>

      <Suspense fallback={null}>
        <JoinStep />
      </Suspense>

      {qr && (
        <section className="hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:flex md:items-center md:gap-5">
          <div className="size-[200px] shrink-0 rounded-xl border border-zinc-200 bg-white p-2 [&>svg]:size-full" role="img" aria-label="휴대폰으로 이 페이지 열기 QR 코드" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <p className="font-semibold">휴대폰 카메라로 찍어 주세요</p>
            <p className="mt-1 text-sm text-zinc-600">이 페이지가 휴대폰에서 열려요. 거기서 안드로이드 앱을 받거나 홈 화면에 추가하면 돼요.</p>
          </div>
        </section>
      )}

      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Smartphone className="size-5 text-brand-700" /> 안드로이드
        </h2>
        <p className="mt-1 text-sm text-zinc-600">두 가지 중 고를 수 있어요. 알림을 놓치기 싫다면 설치 앱을 추천해요.</p>

        <div className="mt-4 rounded-2xl border-2 border-brand-600 p-4">
          <p className="font-semibold">
            설치 앱 <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">추천</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {ANDROID_APP_BENEFITS.map((b) => (
              <li key={b} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                <Check className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden /> {b}
              </li>
            ))}
          </ul>
          {apk ? (
            <ApkButton apk={apk} version={ANDROID_APP_VERSION} />
          ) : (
            <p className="mt-3 text-sm text-zinc-500">설치 파일을 준비하고 있어요.</p>
          )}
          <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed text-zinc-700">
            <li>
              [앱 받기]를 누르고, 받기가 끝나면 화면 아래(또는 알림창)에 뜨는 <b>[열기]</b>를 눌러요. 카카오톡 안에서 눌렀다면 크롬이 열리면서 받아져요.
            </li>
            <li>
              &lsquo;출처를 알 수 없는 앱&rsquo;을 물으면 <b>[설정] → 이 출처 허용</b>을 켜고 돌아와요.
            </li>
            <li>
              <b>[설치]</b>를 눌러요. 구글 보안 검사가 경고를 띄우면 <b>[세부정보 더보기] → [무시하고 설치]</b>를 눌러 주세요(스토어에 아직 올리지 않은 앱이라 뜨는 안내예요).
            </li>
            <li>앱을 열어 가입할 때와 같은 방법으로 로그인하고 [알림 켜기]를 눌러요.</li>
          </ol>
        </div>

        <div className="mt-3 rounded-2xl border border-zinc-200 p-4">
          <p className="font-semibold">홈 화면에 추가 (설치 없이)</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">
            크롬 주소창 오른쪽 <b>⋮ 메뉴</b>(삼성 인터넷은 아래 <b>≡</b>) → <b>[홈 화면에 추가]</b>. 알림도 오지만 진동·소리는 휴대폰의 기본 설정을 따라요.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Smartphone className="size-5 text-brand-700" /> 아이폰
        </h2>
        <p className="mt-1 text-sm text-zinc-600">아이폰은 설치 파일 없이 홈 화면에 추가해서 앱처럼 써요. 알림도 와요(iOS 16.4 이상).</p>
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed text-zinc-700">
          <li>
            이 화면을 <b>Safari</b>로 열어요(카카오톡 안에서 열렸다면 오른쪽 아래 <b>⋯ → [Safari로 열기]</b>).
          </li>
          <li>
            아래 가운데 <b>[공유]</b>(네모에 위쪽 화살표)를 눌러요.
          </li>
          <li>
            목록을 내려 <b>[홈 화면에 추가]</b> → 오른쪽 위 <b>[추가]</b>.
          </li>
          <li>
            홈 화면에 생긴 <b>Moa-on 아이콘</b>으로 열고 로그인 → [알림 켜기]. 아이콘으로 열어야 알림을 받을 수 있어요.
          </li>
        </ol>
      </Card>
    </PageShell>
  );
}
