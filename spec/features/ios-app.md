# 아이폰 설치 앱 (D-259)

- 근거: 사용자 2026-11-12 "아이폰도 마찬가지로 앱스토어에 올릴 수 있도록 만드는 작업해줘"(서비스명·도메인은 아직 미정), `implementation/todo_improvement.md` [개선사항 1]
- 같은 구조: 안드로이드 설치 앱(D-228, `android-app.md`) — 우리 웹(운영 주소)을 그대로 여는 Capacitor 앱 + 알림만 FCM

## 1. 무엇을 만드나
- `mobile/ios` — Capacitor 8 아이폰 프로젝트(Swift Package Manager, CocoaPods 없음). 앱 ID `kr.damounlab.app`(안드로이드와 같음), 이름 `Moa-on`(서비스명 확정 시 `capacitor.config.json` appName·`Info.plist` CFBundleDisplayName 두 곳만 바꿈)
- 화면은 웹 그대로(`server.url` = 운영 주소). 주소(도메인)가 바뀌면 `capacitor.config.json` `server.url` 한 곳 + 새 빌드
- 지원: iOS 15 이상, 아이폰·아이패드(세로·가로)
- 아이콘·시작 화면: 웹 아이콘과 같은 모양(`scripts/apply-brand.mjs`로 만듦, 1024 아이콘은 투명 없음)

## 2. 알림
- 아이폰 앱도 **FCM 토큰**을 서버에 등록한다: 앱(AppDelegate)이 Apple 기기 토큰(APNs)을 Firebase에 넘겨 FCM 토큰으로 바꾸고, 웹은 지금처럼 `PushNotifications` 'registration'으로 받는다. 서버(`lib/push/fcm.ts`)는 안드로이드와 같은 길로 보낸다
- 서버 메시지에 아이폰용 설정: 채팅·회의(급함) = 우선순위 10, 그 외 5 · 같은 tag는 앞 알림을 바꾸고 같은 방끼리 묶음 · 소리 기본
- 토큰 표 `push_app_tokens.platform`에 `ios` 허용(migration 151). 아이폰 앱이 있는 사람은 아이폰 웹 알림(Safari 홈 화면)은 건너뜀(같은 알림 두 번 방지, 안드로이드와 같은 규칙)
- 알림을 누르면 그 화면, 대화방을 열면 그 방 알림을 닫음 — 안드로이드와 같음
- Firebase 설정 파일(`GoogleService-Info.plist`)이 없으면 앱은 열리고 알림만 안 됨

## 3. 로그인(카카오·Google)
- 안드로이드와 같음(D-230): 로그인은 휴대폰 브라우저(Safari)에서 하고 `kr.damounlab.app://auth/callback`으로 앱에 돌아와 앱 안에서 마침. 아이폰 앱에 이 주소(URL scheme) 등록. Supabase 로그인 허용 주소에는 이미 있음

## 4. 권한 문구(아이폰이 처음 물어볼 때 보이는 말)
- 카메라: 영수증·증빙 사진을 찍고 출퇴근 QR을 읽을 때
- 사진: 영수증·증빙 사진을 앨범에서 고를 때 / 이미지를 앨범에 저장할 때
- 암호화 수출 신고: 표준 HTTPS만 → '해당 없음'(`ITSAppUsesNonExemptEncryption` = false)

## 5. 빌드·올리기 (Mac 없이)
- GitHub Actions `iOS 앱 빌드`(손으로 실행): `upload` 끔 = 서명 없이 확인용 빌드, 켬 = App Store용 서명·빌드 → App Store Connect(TestFlight)에 올림
- 버전 = `mobile/package.json` version, 빌드 번호 = 실행 번호(자동 증가)
- 서명은 Apple 클라우드 자동 서명(App Store Connect API 키) — 인증서·프로비저닝 파일을 손으로 만들지 않음
- Mac이 있으면 `mobile/ios/App/App.xcodeproj`를 Xcode로 열어 Archive → 올리기도 됨(설정 파일 `GoogleService-Info.plist`를 `App/App`에 넣고)

## 6. 사용자 준비(순서대로)
1. Apple Developer Program 가입(연 99달러, 사업자면 D-U-N-S 번호로 '조직' 가입 권장 — 판매자 이름이 회사명으로 보임)
2. Apple Developer › Identifiers: 앱 ID `kr.damounlab.app` 만들고 **Push Notifications** 켜기
3. Apple Developer › Keys: APNs 키(.p8) 만들기 → Firebase 콘솔 › 프로젝트 설정 › 클라우드 메시징 › Apple 앱 구성에 올리기
4. Firebase 콘솔: 같은 프로젝트에 아이폰 앱(번들 ID `kr.damounlab.app`) 추가 → `GoogleService-Info.plist` 받기
5. App Store Connect: 새 앱(번들 ID `kr.damounlab.app`, 이름은 서비스명 확정 뒤 — 임시 이름도 됨) + 사용자 및 액세스 › 통합 › API 키(관리자) 만들기
6. GitHub 저장소 Secret 5개: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_B64`, `IOS_GOOGLE_SERVICE_INFO_PLIST_B64`
7. Actions › iOS 앱 빌드 › Run workflow(upload 켬) → TestFlight에서 실기기 설치·확인 → 심사 제출

## 7. 심사 전에 정해야 할 것(구현 보류 — 사용자 결정 필요)
App Store 심사 기준상 아래가 없으면 반려될 수 있다. 지금 앱 기능·화면을 바꾸는 일이라 이번 작업에는 넣지 않았다.
- **Apple로 로그인**(심사 기준 4.8): 카카오·Google 로그인이 있는 앱은 Apple 로그인(또는 같은 수준의 개인정보 보호 로그인)도 있어야 함. Supabase 인증 설정 변경 + Apple 키 필요
- **앱 안에서 계정 삭제**(5.1.1(v)): 앱에서 가입할 수 있으면 앱에서 탈퇴(계정 삭제)도 할 수 있어야 함. 지금 직원 탈퇴 기능 없음
- **앱 안 결제 안내**(3.1.1): 아이폰 앱에서 요금제 결제·결제 페이지 링크를 보이면 Apple 결제를 쓰라는 반려 위험. 아이폰 앱에서는 요금제 결제 버튼을 숨길지 결정
- **웹을 감싼 앱**(4.2): 웹사이트를 그대로 여는 앱은 '최소 기능'으로 반려되기도 함. 앱 알림·카메라 QR 출퇴근 등 앱다운 기능을 심사 메모에 설명
- **심사용 계정**(2.1): 로그인해야 쓰는 앱이라 심사자용 예시 회사·계정(아이디·비밀번호)이 필요
- 개인정보 처리방침 주소·개인정보 수집 항목(App Store Connect 입력)
