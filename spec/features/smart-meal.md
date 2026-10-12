# [Spec] 식대 스마트 분할 정산 로직

## 1. 개요
직원이 점심 식대나 야근 식대를 개인 카드로 결제했을 때, 회사가 설정한 지원 한도에 맞춰 자동으로 회사 부담금과 개인 부담금을 쪼개주는 로직.

## 2. 비즈니스 규칙
- `companies.max_meal_amount` (예: 10,000원)을 기준으로 동작.
- 직원이 입력한 총 결제 금액을 `amount`라 한다.
- **케이스 A (amount <= max_meal_amount)**:
  - `company_supported_amount` = `amount`
  - `personal_burden_amount` = 0
- **케이스 B (amount > max_meal_amount)**:
  - `company_supported_amount` = `max_meal_amount` (예: 10,000원)
  - `personal_burden_amount` = `amount` - `max_meal_amount` (예: 13,000 - 10,000 = 3,000원)
- UI에서는 직원이 영수증을 올렸을 때 이 분할 결과를 실시간으로 계산하여 화면에 인폼해 주어야 한다 ("회사 지원 10,000원 + 개인 부담 3,000원").