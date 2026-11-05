-- 119_legal_version_workon.sql — 약관·개인정보 처리방침 버전 2026-11-05 (D-218 회의 자료 보관 항목 + D-220 서비스 이름 WORKON)
-- 동의 기록에 남는 버전만 바뀐다(이미 가입한 사람에게 다시 동의를 받지 않음 — 서비스 이름·보관 항목 추가)
update private.app_settings set value = '2026-11-05' where key in ('terms_version', 'privacy_version');
