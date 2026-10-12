# Implementation Todo (`pocket-expense`)

## Phase 1: MVP Core Features (현재 진행 단계)
- [ ] Supabase 프로젝트 생성 및 초기 DB 스키마 마이그레이션 적용 (`supabase/migrations/001_initial_schema.sql`)
- [ ] Next.js 프로젝트 기본 레이아웃 및 모바일 퍼스트 TailwindCSS 스타일링 세팅
- [ ] 관리자용 회사(Workspace) 생성 및 기본 규칙 설정 화면 구현 (식대 한도, 유류비 단가)
- [ ] 직원용 모바일 웹 간편 온보딩 (휴대폰 번호 인증 및 Workspace 매핑)
- [ ] 3대 경비 항목(출장비, 식대, 외부 미팅비) 등록 폼 UI 구현
- [ ] Vision LLM 영수증 파싱 API 연동 (상호명, 금액, 날짜 추출 및 에디터 UI)
- [ ] 카카오내비 API 연동 자차 거리 계산 및 유류비 자동 산정 로직 구현
- [ ] 식대 1만 원 초과 시 개인 부담금 자동 분할 정산 로직 구현
- [ ] 관리자 대시보드 경비 승인/반려 프로세스 및 상태 값 관리 (`draft` -> `submitted` -> `approved` -> `paid`)
- [ ] 월말 세무사 전달용 엑셀(CSV) 및 원본 영수증 PDF 지출결의서 패키지 출력 기능 구현