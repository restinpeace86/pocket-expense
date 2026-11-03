import { Suspense } from "react";
import { ChatRoom } from "@/components/chat/chat-room";

// 대화방(D-203). 참여자인지는 DB 함수가 확인한다(아니면 '찾을 수 없어요')
export default function ChatRoomPage({ params }: PageProps<"/workspace/[id]/chat/[roomId]">) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-[#b2c7da]" />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: Pick<PageProps<"/workspace/[id]/chat/[roomId]">, "params">) {
  const { roomId } = await params;
  return <ChatRoom key={roomId} roomId={roomId} />;
}
