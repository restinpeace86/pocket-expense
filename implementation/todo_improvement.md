[개선사항 1] 현재 Next.js 기반으로 소기업용 지출 정산 SaaS (PocketExpense)를 개발 중입니다. 
카카오톡 공유하기 기능을 구현했는데 문제가 발생하여 이를 수정하고자 합니다.

### 📌 현재 카카오 디벨로퍼스(Kakao Developers) 설정 상태
- JavaScript SDK 도메인에 아래 주소들이 모두 정상 등록되어 있습니다.
  1. http://localhost:3000
  2. https://pocket-expense-ruby.vercel.app
- 카카오 로그인 리다이렉트 URI는 현재 사용하지 않아 비어 있습니다.

### ⚠️ 현재 문제 상황
- 앱 내에서 '카카오톡 공유하기' 버튼을 눌러 다른 사람에게 링크를 전송했을 때, 상대방이 채팅방에서 링크를 누르면 배포 주소가 아니라 `localhost:3000`으로 연결되어 페이지가 열리지 않습니다.
- 카카오 콘솔 설정은 완료되었으나, 코드 내에서 `Kakao.Share.sendDefault`를 호출할 때 링크 주소(`webUrl`, `mobileWebUrl`)가 `localhost:3000`으로 하드코딩되어 있거나 환경 변수 처리가 잘못된 것으로 추정됩니다.

### 🛠️ 요청 사항
1. 프로젝트 내에서 카카오 공유하기 관련 코드(`Kakao.Share.sendDefault` 등을 사용하는 파일)를 찾아주세요.
2. 하드코딩된 `localhost:3000` 부분을 실제 Vercel 배포 주소(`https://pocket-expense-ruby.vercel.app`) 또는 `process.env.NEXT_PUBLIC_SITE_URL` 같은 환경 변수를 활용하여 동적으로 처리되도록 코드를 수정해 주세요.
3. 관련 컴포넌트의 전체 수정된 코드를 보여주세요.
