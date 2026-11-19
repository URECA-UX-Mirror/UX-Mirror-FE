import { VERSIONS } from '../new-analysis/constants.ts'
import { GOAL_PAGE_NAMES } from '../improvement/labels.ts'

/** 비교 화면의 두 쪽 이름. 화면에는 `before`·`after` 대신 버전 이름(지금 화면·개선안)을 보인다 */
export const SIDE_NAMES: Readonly<Record<'before' | 'after', string>> = {
  before: VERSIONS.find((v) => v.variant === 'before')!.name,
  after: VERSIONS.find((v) => v.variant === 'after')!.name,
}

const PAGE_NAMES_BY_KEY: Readonly<Record<string, string>> = { home: '홈', ...GOAL_PAGE_NAMES }

/** 화면(pageKey) 이름. MORO MARKET의 알려진 화면은 한국어 이름, 그 밖에는 서버가 준 화면 이름을 그대로 쓴다 */
export const pageName = (pageKey: string): string => PAGE_NAMES_BY_KEY[pageKey] ?? pageKey

/** 비교 조건 검사 항목(`conditionChecks[].code`, BE `uxm/comparison.py`) */
const CONDITION_LABELS: Readonly<Record<string, string>> = {
  MODEL_VERSION_MATCHED: 'AI 모델 버전',
  MODEL_ENDPOINT_MATCHED: 'AI 모델 연결',
  DECISION_MODE_MATCHED: 'AI 판단 방식',
  PROMPT_VERSION_MATCHED: 'AI 지시문 버전',
  GOAL_MATCHED: '할 일',
  PERSONA_MATCHED: '고객 유형',
  GOAL_JUDGMENT_MODE_MATCHED: '도착 판정 방식',
  MAX_STEPS_MATCHED: '최대 클릭 수',
  BACK_LIMITS_MATCHED: '뒤로 가기 한도',
  START_PATH_MATCHED: '시작 화면',
  BROWSER_STATE_MATCHED: '브라우저 시작 상태',
  VIEWPORT_MATCHED: '화면 크기',
  SITE_VERSION_MATCHED: '사이트 버전',
  LAYOUT_MATCHED: '화면 배치',
  TEMPERATURE_MATCHED: 'AI 응답 설정',
  THRESHOLD_CONFIG_MATCHED: '판단 기준값',
  ANALYSIS_VERSION_MATCHED: '분석 방식 버전',
  REFERENCE_PATH_CONFIG_MATCHED: '경로 지표 기준',
  CANDIDATE_POLICY_MATCHED: '누를 곳 고르는 규칙',
  RESULT_ORIGIN_MATCHED: '결과 출처',
}

export const conditionLabel = (code: string): string => CONDITION_LABELS[code] ?? '기타 조건'
