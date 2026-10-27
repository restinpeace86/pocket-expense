"use client";

import { AlertTriangle, SearchX, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// 공통 오류 화면(7-15, spec/common/ui-rules.md §5): 없는 주소·볼 수 없는 화면(not-found)과 예상 못 한 오류(error)를
// 한국어 안내 + 할 일(다시 시도·홈으로)로 보여 준다. 워크스페이스 안에서는 메뉴(레이아웃)를 그대로 두고 본문만 바꾼다.

// 지금 주소의 회사 워크스페이스 홈. 워크스페이스 밖이면 첫 화면
function useHomeHref(area?: "admin" | "employee") {
  const params = useParams<{ id?: string }>();
  if (!params?.id) return "/";
  return `/workspace/${params.id}/${area ?? "employee"}`;
}

export function NotFoundState({ area }: { area?: "admin" | "employee" }) {
  const home = useHomeHref(area);
  return (
    <Frame icon={<SearchX className="size-7" aria-hidden />} title="찾는 화면이 없어요">
      <p>지워졌거나, 주소가 잘못됐거나, 볼 수 있는 권한이 없는 화면이에요.</p>
      <p>링크를 받았다면 보낸 사람에게 다시 확인해 주세요.</p>
      <Actions>
        <Link href={home} className={primary}>
          홈으로
        </Link>
        <BackButton />
      </Actions>
    </Frame>
  );
}

export function ErrorState({ error, retry, area }: { error: unknown; retry: () => void; area?: "admin" | "employee" }) {
  const home = useHomeHref(area);
  const offline = useOffline();
  useEffect(() => {
    console.error(error);
  }, [error]);
  if (offline) {
    return (
      <Frame icon={<WifiOff className="size-7" aria-hidden />} title="인터넷 연결이 끊겼어요">
        <p>와이파이나 모바일 데이터를 확인해 주세요. 연결되면 [다시 시도]를 눌러 이어서 할 수 있어요.</p>
        <Actions>
          <button type="button" onClick={retry} className={primary}>
            다시 시도
          </button>
        </Actions>
      </Frame>
    );
  }
  return (
    <Frame icon={<AlertTriangle className="size-7" aria-hidden />} title="화면을 불러오지 못했어요">
      <p>잠깐 문제가 생겼어요. [다시 시도]를 눌러 주세요.</p>
      <p>계속 같은 화면이 나오면 새로고침하거나 다시 로그인해 주세요. 자동 저장된 내용은 그대로 남아 있어요.</p>
      <Actions>
        <button type="button" onClick={retry} className={primary}>
          다시 시도
        </button>
        <Link href={home} className={secondary}>
          홈으로
        </Link>
      </Actions>
    </Frame>
  );
}

function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}

function BackButton() {
  return (
    <button type="button" onClick={() => history.back()} className={secondary}>
      이전 화면
    </button>
  );
}

const primary = "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700";
const secondary = "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 font-medium text-zinc-800 hover:bg-zinc-50";

function Frame({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">{icon}</div>
      <h1 className="mt-4 text-balance text-xl font-bold tracking-tight text-zinc-900">{title}</h1>
      <div role="alert" className="mt-2 flex flex-col gap-1 text-pretty break-keep text-sm leading-relaxed text-zinc-600">
        {children}
      </div>
    </main>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex w-full gap-2">{children}</div>;
}
