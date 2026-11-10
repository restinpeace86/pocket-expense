-- =============================================================================
-- 138_alimtalk_switch.sql — 핵심 알림은 앱 안(앱 알림 + 채팅 [알림]방)으로, 카카오 알림톡은 회사별 추가 서비스 스위치 (D-247)
-- 사용자 결정(2026-11-10): 29,000원(스타터)은 앱 안 메신저 알림만. 카카오 알림톡은 나중에 49,000원·89,000원 요금제의 추가 서비스로.
-- company_features (회사, 'alimtalk', true)일 때만 '앱 알림을 못 받은 사람에게 알림톡'을 보낸다. 줄이 없으면 꺼짐(운영자만 켬)
-- =============================================================================
alter table public.company_features drop constraint company_features_feature_check;
alter table public.company_features add constraint company_features_feature_check check (feature in ('messenger', 'attendance', 'calendar', 'alimtalk'));
