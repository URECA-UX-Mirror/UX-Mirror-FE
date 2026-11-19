import { expect, it } from 'vitest'
import { ApiError } from '../src/api/client.ts'
import { plainServerMessage, startFailureMessage } from '../src/shared/serverMessage.ts'

// 서버 안내 문장은 깨끗한 한글일 때만 그대로 보인다. 경로·필드 이름·영문 원문은 보이지 않는다

const FALLBACK = '시작하지 못했어요. 잠시 뒤 다시 해 주세요.'
const error = (code: string, message: string, status = 422) => new ApiError({ status, code, message, retryable: false })

it.each([
  '도착 화면을 찾지 못했어요',
  'AI 개선은 MORO MARKET 진단에서만 할 수 있어요.',
  '고객이 하려는 일을(를) 조금 더 구체적으로 적어 주세요 (4자 이상).',
])('깨끗한 한글 문장은 그대로: %s', (message) => {
  expect(plainServerMessage(message)).toBe(message)
})

it.each([
  ['영문뿐', 'Run run_x is active'],
  ['경로가 있다', '도착 화면 /shop/refund 를 열지 못했습니다'],
  ['필드 이름이 있다', 'goalId와 goal 중 하나만 보내야 합니다.'],
  ['환경변수 이름이 있다', '서버의 SHOP_AFTER_URL·SHOP_AFTER_LABEL을 확인해 주세요.'],
  ['비어 있다', '   '],
  ['없다', null],
])('보이면 안 되는 문장(%s)은 null', (_name, message) => {
  expect(plainServerMessage(message)).toBeNull()
})

it('알려진 코드는 서버 문장과 상관없이 정해 둔 말을 쓴다', () => {
  expect(startFailureMessage(error('RUN_ALREADY_ACTIVE', '자동 개선이 이미 진행 중입니다.', 409), FALLBACK)).toBe('다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.')
  expect(startFailureMessage(error('IMPROVEMENTS_DISABLED', '지금은 AI 개선을 새로 시작할 수 없어요.', 503), FALLBACK)).toBe('지금은 개선안을 받아 볼 수 없어요.')
  expect(startFailureMessage(error('SITE_NOT_CONFIGURED', '서버의 SHOP_AFTER_URL을 확인해 주세요.', 503), FALLBACK)).toBe('사이트가 아직 준비되지 않았어요. 잠시 뒤 다시 해 주세요.')
})

it('입력 오류는 깨끗한 한글이면 그대로, 아니면 "입력을 다시 확인해 주세요."', () => {
  expect(startFailureMessage(error('CONTRACT_VALIDATION_ERROR', '도착 화면을 찾지 못했어요'), FALLBACK)).toBe('도착 화면을 찾지 못했어요')
  expect(startFailureMessage(error('CONTRACT_VALIDATION_ERROR', 'startPath는 /shop/{home} 중 하나여야 합니다.'), FALLBACK)).toBe('입력을 다시 확인해 주세요.')
})

it('그 밖의 오류와 API 오류가 아닌 것은 깨끗한 한글이 아니면 대체 문장이다', () => {
  expect(startFailureMessage(error('BROWSER_ERROR', 'TimeoutError: page.goto', 503), FALLBACK)).toBe(FALLBACK)
  expect(startFailureMessage(error('BROWSER_ERROR', '화면을 열지 못했어요', 503), FALLBACK)).toBe('화면을 열지 못했어요')
  expect(startFailureMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK)
})
