-- 151: 아이폰 설치 앱 알림 토큰(D-259, spec/features/ios-app.md)
-- 아이폰 앱도 FCM 토큰을 등록한다(앱이 APNs → FCM으로 바꿔 줌). 기기 종류에 'ios'를 허용 — 권한·회사 격리는 123 그대로
alter table public.push_app_tokens drop constraint if exists push_app_tokens_platform_check;
alter table public.push_app_tokens add constraint push_app_tokens_platform_check check (platform in ('android', 'ios'));
