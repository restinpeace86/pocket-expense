[개선사항 1] 
현재 5~20인 소기업 대상 B2B 경비정산 SaaS 서비스인 '다모-온 (damo-on.com)'의 Next.js (App Router) 프로젝트 SEO 최적화 작업을 진행하려고 해. 아래 요구사항에 맞게 메타데이터 및 시맨틱 태그 관련 코드를 작성하고 적용해줘.

[프로젝트 및 SEO 기본 정보]
- 서비스명: 다모온 (damo-on)
- 도메인: https://damo-on.com
- 타깃 고객: 5~20인 소규모 기업, 스타트업, 개인사업자
- 핵심 키워드: 소기업 경비정산, B2B 경비정산 SaaS, 영수증 관리, 법인카드 정산, 경비 승인, 다모온
- 주요 기능: 모바일 영수증 촬영/제출, 법인카드 및 경비 내역 자동 수집, 경비 승인 웹 서비스

[작업 요구사항]

1. 루트 레이아웃(app/layout.tsx) 또는 메인 페이지(app/page.tsx) 메타데이터 설정
   - Metadata 객체를 사용하여 Title, Description, Keywords 설정
   - OpenGraph(og:title, og:description, og:url, og:siteName, og:locale, og:type) 설정
   - Twitter Card 메타데이터 설정
   - canonical URL (https://damo-on.com) 지정

2. 시맨틱 HTML 태그 최적화 (app/page.tsx 또는 랜딩 컴포넌트)
   - 메인 랜딩 페이지에 <h1> 태그가 1개 존재하도록 설정 (예: "소규모 기업을 위한 가장 쉬운 B2B 경비정산 SaaS, 다모-온")
   - 주요 기능 섹션 제목에 <h2>, <h3> 시맨틱 태그 배치

3. robots.txt 및 sitemap.ts 확인 및 동적 생성 코드 반영
   - app/robots.ts (또는 public/robots.txt): Googlebot 등 검색 로봇 수집 허용 및 sitemap 위치 지정
   - app/sitemap.ts: 메인 페이지 및 주요 공개 페이지 포함 사이트맵 동적 리턴 로직 구현

위 요구사항을 바탕으로 변경 또는 새로 추가해야 하는 파일 경로와 코드 전체를 수정하여 적용해줘.
