import { MessageCircle } from "lucide-react";

// 넓은 화면 오른쪽(대화방을 고르기 전). 휴대폰은 목록만 보인다
export default function ChatHomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
      <MessageCircle className="size-10 text-zinc-300" />
      왼쪽에서 대화방을 고르거나 새 채팅을 시작하세요.
    </div>
  );
}
