"use client";

import { chatSim } from "./chat";
import { closingSim } from "./closing";
import { convertSim } from "./convert";
import { leaveSim } from "./leave";
import { qrSim } from "./qr";
import { receiptSim } from "./receipt";
import { roomsSim } from "./rooms";
import { threadsSim } from "./threads";
import { SimPlayer, type SimDef } from "./sim-player";

// 시뮬레이션 목록(D-255 §B). 도움말 글의 sim 키와 같다. 랜딩 [기능 미리 보기] 탭 순서
export const SIMS: SimDef[] = [receiptSim, qrSim, leaveSim, convertSim, roomsSim, threadsSim, chatSim, closingSim];
export const SIM_KEYS = SIMS.map((s) => s.key);

export function Sim({ simKey, tone, autoPlay, playNow }: { simKey: string; tone?: "light" | "dark"; autoPlay?: boolean; playNow?: boolean }) {
  const def = SIMS.find((s) => s.key === simKey);
  return def ? <SimPlayer key={def.key} def={def} tone={tone} autoPlay={autoPlay} playNow={playNow} /> : null;
}
