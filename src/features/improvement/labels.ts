import { isApiError } from '../../api/client.ts'
/** AI 개선 화면의 사람 말 라벨 */

/** 도착 화면 pageKey → 이름 (BE 동결 계획의 기본 목표 화면) */
export const GOAL_PAGE_NAMES: Record<string, string> = {
  refund: '환불 신청',
  orders: '주문·배송 조회',
  mypage: '마이페이지',
  support: '고객센터',
}

export const goalPageName = (pageKey: string) => GOAL_PAGE_NAMES[pageKey] ?? pageKey

/** 지나간 화면 이름 (Run 경로의 pageKey). 모르는 화면은 "다른 화면". 후보 비교 화면도 쓴다 */
const SCREEN_NAMES: Record<string, string> = { home: '홈', ...GOAL_PAGE_NAMES, orders: '주문 내역' }
export const screenName = (pageKey: string) => SCREEN_NAMES[pageKey] ?? '다른 화면'

/** 시각을 이 브라우저 시간대의 "MM-DD HH:mm"으로. 읽을 수 없으면 `null` */
export function shortTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

/** 결과의 출처 (`kind`, BE #131). `UNKNOWN`(연습 실행처럼 출처를 확인할 수 없는 결과 파일)과 모르는 값은 같은 문구다 */
export function kindLabel(kind: string): string {
  if (kind === 'LIVE') return '심사위원 실행 (공식 기록 아님)'
  if (kind === 'OFFICIAL') return '사전 등록 공식 결과'
  return '출처 확인 안 된 결과'
}

/** 낱말 뒤 "로/으로". 받침 없음·ㄹ 받침은 "로", 다른 받침은 "으로", 한글이 아니면 "(으)로" */
export function roOf(word: string): string {
  const final = finalOf(word)
  if (final === null) return '(으)로'
  return final === 0 || final === 8 ? '로' : '으로'
}

/** 낱말 뒤 "을/를". 한글이 아니면 "을(를)" */
export function eulOf(word: string): string {
  const final = finalOf(word)
  if (final === null) return '을(를)'
  return final === 0 ? '를' : '을'
}

/** 마지막 글자의 받침 번호(0 = 받침 없음). 한글 음절이 아니면 `null` */
function finalOf(word: string): number | null {
  const text = word.trim()
  const code = text.charCodeAt(text.length - 1) - 0xac00
  if (Number.isNaN(code) || code < 0 || code > 11171) return null
  return code % 28
}

/** 이름 하나를 따옴표로 */
export const quote = (label: string) => `'${label}'`

/** AI 개선 시작 실패 안내 */
export function startErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'RUN_ALREADY_ACTIVE') return '다른 진단이나 AI 개선이 진행 중이에요. 끝나면 시작할 수 있어요.'
    if (error.message.trim()) return error.message
  }
  return 'AI 개선을 시작하지 못했어요. 잠시 뒤 다시 해 주세요.'
}
