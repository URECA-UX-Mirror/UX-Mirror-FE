import { sentenceProblem } from './inputRules.ts'

/** 고객 유형 고르기 (직접 쓰기도 가능) */
export const PERSONA_CHOICES = ['온라인 쇼핑이 낯선 고객', '50대 이상 고객', '바쁜 고객'] as const

/** 진단·AI 개선이 같이 쓰는 도착 화면 (MORO MARKET). 확인 글자는 BE 동결 계획(results/improvement_plan_1119b.json)의 같은 화면 목표와 같고, 화면에는 숨긴다 */
export const GOAL_SCREENS = [
  { pageKey: 'refund', label: '환불 신청', path: '/shop/refund', text: '환불 / 반품 신청' },
  { pageKey: 'orders', label: '주문·배송 조회', path: '/shop/orders', text: '주문 / 배송 조회' },
  { pageKey: 'mypage', label: '마이페이지', path: '/shop/mypage', text: '사용 가능 쿠폰' },
  { pageKey: 'support', label: '고객센터', path: '/shop/support', text: '자주 묻는 질문' },
] as const

export interface CustomerInput {
  persona: string
  goal: string
  pageKey: string
}

export const EMPTY_INPUT: CustomerInput = { persona: PERSONA_CHOICES[0], goal: '', pageKey: GOAL_SCREENS[0].pageKey }

/** 입력에 문제가 있으면 칸별 안내, 없으면 null */
export function inputProblems(input: CustomerInput): { persona: string | null; goal: string | null } | null {
  const persona = sentenceProblem(input.persona, '고객 유형')
  const goal = sentenceProblem(input.goal, '고객이 하려는 일')
  return persona || goal ? { persona, goal } : null
}

export const screenOf = (pageKey: string) => GOAL_SCREENS.find((s) => s.pageKey === pageKey) ?? GOAL_SCREENS[0]
