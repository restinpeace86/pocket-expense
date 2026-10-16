# [Spec] 카카오 알림톡 결재 알림

관련: D-007, D-013, D-034, O-01 / 데이터: `notification_logs` / 알림 단위: 지출소명서 1건 / 트리거·템플릿: `spec/screens/notification-rule.md`

## 1. 개요
결재 요청과 결과를 카카오 알림톡으로 보내, 결재자와 직원이 앱 설치 없이 카카오톡 링크로 바로 처리·확인하게 한다.

## 2. 발송 구조
- 발송은 `NotificationSender` 어댑터 인터페이스 뒤에 둔다. 드라이버는 환경변수 `ALIMTALK_DRIVER`로 고른다.
  - `log`(기본값): 실제 발송 없이 `notification_logs`에 `provider='log'`, `status='sent'`로 기록하고 서버 로그에 메시지·링크를 출력한다. 개발·테스트용.
  - 실제 발송대행사 드라이버: 대행사 선정 후 추가한다(**O-01, 구현 보류**). 필요한 키는 `.env.local`에만 둔다.
- 발송은 결재 트랜잭션 **커밋 이후** 수행한다. 발송 실패가 결재 처리를 되돌리지 않는다.
- 수신 번호는 `members.phone`. 번호가 비었거나 형식이 틀리면 `failed`로 기록한다.

## 3. 템플릿
- 템플릿 목록(6종: `APPROVAL_REQUEST`, `APPROVAL_COMPLETED`, `APPROVAL_REJECTED`, `PAYOUT_COMPLETED`, `INVITE`, `REMINDER`), 발송 시점, 수신자, 문구, 버튼 링크는 **`spec/screens/notification-rule.md`가 단일 기준**이다.
- 링크 기준 URL은 `NEXT_PUBLIC_SITE_URL`. 알림톡 버튼 링크 도메인은 템플릿 심사 시 등록한다.

## 4. 링크 진입 보안 (D-013)
- 링크에는 비밀 토큰을 넣지 않는다. 진입 시 로그인 여부를 확인하고, 미로그인이면 `/login?next=<링크 경로>`로 보낸 뒤 원래 화면으로 돌아온다.
- 로그인한 멤버가 해당 소명서의 현재 단계 처리 권한자(사전 검토자 또는 본인 제외 관리자 이상)가 아니면 읽기 전용(열람 권한이 있을 때) 또는 "접근 권한이 없습니다" 안내.

## 5. 실패 처리
- 실패 건은 `notification_logs.status='failed'`와 `error_message`를 남긴다. 자동 재시도는 1회(30초 후)만 한다.
- 관리자 `/admin/notifications`에서 실패 건을 보고 [재발송]할 수 있다.
- 알림톡이 실패해도 결재자는 내 결재함에서 대기 건을 볼 수 있으므로 결재가 막히지 않는다.
