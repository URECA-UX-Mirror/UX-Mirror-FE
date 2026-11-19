import { expect, it } from 'vitest'
import { toSite } from '../src/adapters/site.ts'
import { matchScreen, MORO_KEYWORDS, screenWords, type GoalScreen } from '../src/features/new-analysis/matchScreen.ts'
import { SITES } from '../src/mocks/fixtures/sites.ts'
import { GOAL_SCREENS } from '../src/shared/customerInput.ts'

// 문장의 낱말로 찾아야 할 화면 고르기 (AI 없음). 못 고르면 null이고, 화면은 사용자가 직접 고른다

const moro = (sentence: string) => matchScreen(sentence, GOAL_SCREENS, MORO_KEYWORDS)

it.each([
  ['지난주에 산 운동화가 안 맞아서 돌려보내고 싶어요', 'refund'],
  ['환불하고 싶어요', 'refund'],
  ['사이즈 교환이 되는지 알고 싶어요', 'refund'],
  ['배송이 어디쯤인지 궁금해요', 'orders'],
  ['택배가 언제 도착하는지 보고 싶어요', 'orders'],
  ['쿠폰이 있는지 보고 싶어요', 'mypage'],
  ['내정보를 고치고 싶어요', 'mypage'],
  ['상담원에게 질문하고 싶어요', 'support'],
  ['환불 문의를 하고 싶은데 반품도 되나요', 'refund'],
])('예시 쇼핑몰: "%s" → %s', (sentence, pageKey) => {
  expect(moro(sentence)).toBe(pageKey)
})

it.each([
  ['맞는 낱말이 없다', '사이트를 둘러보고 싶어요'],
  ['두 화면이 똑같이 맞는다', '주문한 운동화를 환불하고 싶어요'],
  ['빈 문장', '   '],
])('%s → 고르지 않는다', (_name, sentence) => {
  expect(moro(sentence)).toBeNull()
})

it('같은 낱말이 여러 번 나와도 한 번만 센다', () => {
  // 환불 3번(1점) vs 배송·주문(2점)
  expect(moro('환불 환불 환불, 그리고 배송 주문')).toBe('orders')
})

const onsScreens: GoalScreen[] = toSite(SITES[0]).pages
  .filter((p) => p.goalSelectable && p.goalText !== null)
  .map((p) => ({ pageKey: p.pageKey, label: p.label, path: p.path, text: p.goalText! }))

it('등록 사이트는 화면 이름·확인 글자의 낱말로 맞춘다 (영문은 대소문자를 가리지 않는다)', () => {
  expect(screenWords(onsScreens.find((s) => s.pageKey === 'event')!)).toEqual(['이벤트', 'event'])
  expect(matchScreen('마음에 드는 제품을 담을 화면 찾기', onsScreens)).toBe('products')
  expect(matchScreen('다른 사람이 남긴 상품 리뷰를 보고 싶어요', onsScreens)).toBe('review')
  expect(matchScreen('Event 소식이 궁금해요', onsScreens)).toBe('event')
  expect(matchScreen('장바구니에 뭐가 있는지 보고 싶어요', onsScreens)).toBe('basket')
  // 예시 쇼핑몰 낱말은 등록 사이트에 쓰지 않는다
  expect(matchScreen('환불하고 싶어요', onsScreens)).toBeNull()
})

it('한 글자 낱말은 쓰지 않는다', () => {
  const screens: GoalScreen[] = [{ pageKey: 'a', label: '홈 · 새 소식', path: '/a', text: '새' }]
  expect(screenWords(screens[0])).toEqual(['소식'])
  expect(matchScreen('새 옷을 사고 싶어요', screens)).toBeNull()
})
