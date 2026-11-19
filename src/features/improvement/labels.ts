import { startFailureMessage } from '../../shared/serverMessage.ts'

export { eulOf, quote, roOf } from '../../shared/hangul.ts'
/** AI 개선 화면의 사람 말 라벨 */

/** 도착 화면 pageKey → 이름 (BE 동결 계획의 기본 목표 화면) */
export const GOAL_PAGE_NAMES: Record<string, string> = {
  refund: '환불 신청',
  orders: '주문·배송 조회',
  mypage: '마이페이지',
  support: '고객센터',
}

/** 모르는 화면은 코드값 대신 "다른 화면" */
export const goalPageName = (pageKey: string) => GOAL_PAGE_NAMES[pageKey] ?? '다른 화면'

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

/** AI 개선 시작 실패 안내 */
export function startErrorMessage(error: unknown): string {
  return startFailureMessage(error, '시작하지 못했어요. 잠시 뒤 다시 해 주세요.')
}
