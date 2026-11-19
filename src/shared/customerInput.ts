import { sentenceProblem } from './inputRules.ts'

/**
 * 화면에서는 "누가"를 묻지 않는다. API는 `persona`가 필수라 이 값 하나를 숨겨서 보낸다
 * (임시, docs/operations/open_issue.md OI-9). BE `api/input_rules.py` 문장 검사를 통과하는 값이어야 한다.
 */
export const DEFAULT_PERSONA = '이 쇼핑몰을 처음 써 보는 고객'

/** 찾아야 하는 화면 (MORO MARKET). 확인 글자는 BE 동결 계획(results/improvement_plan_1119b.json)의 같은 화면 목표와 같고, 화면에는 숨긴다 */
export const GOAL_SCREENS = [
  { pageKey: 'refund', label: '환불 신청', path: '/shop/refund', text: '환불 / 반품 신청' },
  { pageKey: 'orders', label: '주문·배송 조회', path: '/shop/orders', text: '주문 / 배송 조회' },
  { pageKey: 'mypage', label: '마이페이지', path: '/shop/mypage', text: '사용 가능 쿠폰' },
  { pageKey: 'support', label: '고객센터', path: '/shop/support', text: '자주 묻는 질문' },
] as const

/** 하려는 일 문장에 문제가 있으면 안내, 없으면 null */
export const goalProblem = (goal: string): string | null => sentenceProblem(goal, '하려는 일')
