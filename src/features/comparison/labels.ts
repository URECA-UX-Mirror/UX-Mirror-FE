import { VERSIONS } from '../new-analysis/constants.ts'
import { GOAL_PAGE_NAMES } from '../improvement/labels.ts'

export type Side = 'before' | 'after'

/** 비교 화면의 두 쪽 이름. 화면에는 `before`·`after` 대신 버전 이름(지금 화면·개선안)을 보인다 */
export const SIDE_NAMES: Readonly<Record<Side, string>> = {
  before: VERSIONS.find((v) => v.variant === 'before')!.name,
  after: VERSIONS.find((v) => v.variant === 'after')!.name,
}

const PAGE_NAMES_BY_KEY: Readonly<Record<string, string>> = { home: '홈', ...GOAL_PAGE_NAMES }

/** 화면(pageKey) 이름. MORO MARKET의 알려진 화면은 한국어 이름, 그 밖에는 서버가 준 화면 이름을 그대로 쓴다 */
export const pageName = (pageKey: string): string => PAGE_NAMES_BY_KEY[pageKey] ?? pageKey

/** 화면별 비교를 할 수 없는 이유(`screenComparisons[].reason`). 모르는 코드는 일반 문구다 */
const REASON_TEXT: Readonly<Record<string, string>> = {
  NOT_VISITED_IN_BEFORE: `${SIDE_NAMES.before}에서는 들르지 않았어요`,
  NOT_VISITED_IN_AFTER: `${SIDE_NAMES.after}에서는 들르지 않았어요`,
  GLOBAL_CONDITIONS_MISMATCH: '두 진단의 설정이 달라요',
  CANDIDATE_SET_MISMATCH: '두 화면의 버튼 구성이 달라요',
  ACTION_SET_MISMATCH: '두 화면의 버튼 구성이 달라요',
}

export const reasonText = (reason: string | null): string =>
  (reason !== null && REASON_TEXT[reason]) || '나란히 견주기 어려운 화면이에요'
