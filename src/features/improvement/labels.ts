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

/** 지나간 화면 이름 (검증 Run 경로의 pageKey). 모르는 화면은 "다른 화면" */
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

/** `LIVE`·`OFFICIAL` (BE #131) */
export function kindLabel(kind: string): string {
  if (kind === 'LIVE') return '직접 실행한 결과'
  if (kind === 'OFFICIAL') return '사전 등록 공식 결과'
  return kind
}

/** AI 개선 시작 실패 안내 */
export function startErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'RUN_ALREADY_ACTIVE') return '지금 다른 진단이나 AI 개선이 진행 중이에요. 끝나면 시작할 수 있어요.'
    if (error.message.trim()) return error.message
  }
  return 'AI 개선을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}
