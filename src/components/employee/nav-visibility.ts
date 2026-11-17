// 직원 하단 메뉴가 보이는 곳(D-207)
// 보임: 홈·정산·내 정보·결재함 목록·캘린더·채팅 목록 / PC만: 대화방 / 숨김: 결의서 편집·상세, 결재 화면(그 화면의 하단 버튼을 쓰기 때문)
export function navVisibility(pathname: string, ws: string): "all" | "pc" | "none" {
  // 결재 문서 한 건(9-33e)도 쓰기·결재 버튼이 아래에 있어 숨김
  if (pathname.startsWith(`${ws}/employee/claims/`) || pathname.startsWith(`${ws}/employee/docs/`) || /\/approvals\/[^/]+/.test(pathname)) return "none";
  if (pathname.startsWith(`${ws}/chat/`)) return "pc";
  if (pathname === `${ws}/chat` || pathname.startsWith(`${ws}/employee`) || pathname.startsWith(`${ws}/approvals`) || pathname.startsWith(`${ws}/calendar`)) return "all";
  return "none";
}
