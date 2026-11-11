// 직원 초대 카카오톡 공유 내용(D-229). 버튼 하나로 보내는 메시지에 두 가지 길을 같이 넣는다:
//  ① [웹으로 가입하기] = 초대 링크(어떤 휴대폰·PC든 바로)
//  ② [앱 설치 안내] = /download?join=초대코드 — 안드로이드 설치 앱 / 아이폰 홈 화면 추가 방법 + 같은 화면에서 가입
// 카카오 피드 메시지는 버튼이 최대 2개, 본문이 짧아서 기기별 요약은 표(itemContent)로, 자세한 순서는 안내 화면에 둔다.
export function installGuideUrl(origin: string, inviteCode: string): string {
  return `${origin.replace(/\/$/, "")}/download?join=${encodeURIComponent(inviteCode)}`;
}

export function inviteShareOptions(p: { companyName: string; joinLink: string; installLink: string; origin: string }) {
  const origin = p.origin.replace(/\/$/, "");
  return {
    objectType: "feed",
    content: {
      title: `${p.companyName}에서 Moa-on에 초대했어요`,
      description: "먼저 [웹으로 가입하기]로 가입 신청을 해 주세요. 휴대폰에서 앱처럼 쓰려면 [앱 설치 안내]를 눌러 내 휴대폰에 맞는 방법을 보세요.",
      imageUrl: `${origin}/share/invite-image`,
      imageWidth: 800,
      imageHeight: 400,
      link: { mobileWebUrl: p.joinLink, webUrl: p.joinLink },
    },
    itemContent: {
      profileText: "휴대폰별로 이렇게 써요",
      items: [
        { item: "안드로이드", itemOp: "설치 앱(알림 확실)" },
        { item: "아이폰", itemOp: "Safari 홈 화면 추가" },
        { item: "PC", itemOp: "웹 그대로" },
      ],
    },
    buttons: [
      { title: "웹으로 가입하기", link: { mobileWebUrl: p.joinLink, webUrl: p.joinLink } },
      { title: "앱 설치 안내", link: { mobileWebUrl: p.installLink, webUrl: p.installLink } },
    ],
  };
}
