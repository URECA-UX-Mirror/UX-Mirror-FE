import type { ReferenceBasis } from '../api/dto/run.ts'
import type { Open } from './types.ts'

// 경로 지표 기준별 표시 문구. 결과 화면과 비교 화면이 같은 문구를 쓰도록 여기에만 둔다.
// 문구만 정하며 거리·우회 이동·확률은 계산하지 않고 백엔드 값을 그대로 표시한다.

/** 기준 없음(`referencePathConfig: null`)의 표시 */
export const NO_REFERENCE_LABEL = '기준 없음'

const BASIS_LABELS: Record<ReferenceBasis, string> = {
  ALLOWED_PATHS: '허용 경로',
  SITE_MAP: '사이트 지도',
}

/** 기준 이름. 모르는 값이 와도 오류로 만들지 않고 값을 그대로 보인다. */
export function referenceBasisLabel(basis: Open<ReferenceBasis> | null): string {
  if (basis === null) return NO_REFERENCE_LABEL
  return BASIS_LABELS[basis as ReferenceBasis] ?? basis
}

export interface PathMetricNames {
  extraSteps: string
  extraNavigationCost: string
  /** `detourMoveCount`. 사이트 지도 기준에서만 의미가 있다 */
  detourMoveCount: string | null
}

const SITE_MAP_NAMES: PathMetricNames = {
  extraSteps: '최단 경로 대비 추가 단계',
  extraNavigationCost: '최단 경로 대비 추가 이동 비용',
  detourMoveCount: '우회 이동',
}

// 허용 경로 기준의 값은 "허용 경로 중 가장 짧은 경로 대비"라 사이트 지도의 최단 경로와 뜻이 다르다
const ALLOWED_PATHS_NAMES: PathMetricNames = {
  extraSteps: '추가 이동(extraSteps)',
  extraNavigationCost: '추가 이동 비용',
  detourMoveCount: null,
}

/**
 * 기준별 지표 이름. 기준 없음이면 이름을 정하지 않는다(`null`).
 * 모르는 기준은 허용 경로 이름을 쓴다.
 */
export function pathMetricNames(basis: Open<ReferenceBasis> | null): PathMetricNames | null {
  if (basis === null) return null
  return basis === 'SITE_MAP' ? SITE_MAP_NAMES : ALLOWED_PATHS_NAMES
}

/** `goalPathProbability` 설명. 기준마다 "목표 경로"가 가리키는 대상이 다르다. */
export function goalPathProbabilityHint(basis: Open<ReferenceBasis> | null): string {
  switch (basis) {
    case 'ALLOWED_PATHS':
      return '허용 경로에서 다음 화면으로 이어지는 클릭 후보들의 확률 합'
    case 'SITE_MAP':
      return '사이트 지도에서 목표에 더 가까워지는 클릭 후보들의 확률 합'
    case null:
      return '경로 기준이 없어 계산하지 않은 값'
    default:
      return '경로 기준에 따라 서버가 계산한 값'
  }
}
