import type { ReactNode } from 'react'
import { pathMetricNames, referenceBasisLabel } from '../../domain/referenceBasis.ts'
import type { RunOutcome } from '../../domain/types.ts'
import type { RunBasis } from './useComparisonData.ts'

interface RunComparisonProps {
  before: RunOutcome
  after: RunOutcome
  /** 각 Run의 경로 지표 기준. `undefined`(모름)이면 기존 표시를 유지한다 */
  beforeBasis?: RunBasis
  afterBasis?: RunBasis
}

const orNull = (value: number | null) =>
  value === null ? '계산 불가' : value

interface Row {
  key: string
  /** 없으면 항상 보인다 */
  visible?: (bases: Bases) => boolean
  label: (bases: Bases) => string
  value: (outcome: RunOutcome, basis: RunBasis) => ReactNode
}

interface Bases {
  before: RunBasis
  after: RunBasis
}

const SITE_MAP = 'SITE_MAP'
const ALLOWED_PATHS = 'ALLOWED_PATHS'
// 기준별 지표 이름은 `referenceBasis.ts`의 헬퍼에서 가져온다
const SITE_MAP_NAMES = pathMetricNames(SITE_MAP)!
const ALLOWED_PATHS_NAMES = pathMetricNames(ALLOWED_PATHS)!

/**
 * 양쪽 기준이 같을 때만 그 기준의 이름을 쓴다(결과 화면과 같은 이름).
 * 기준이 다르거나 모르면(조회 실패·기준 없음) 어느 한쪽 이름을 붙이면 다른 쪽에 틀리므로 중립 이름을 쓴다.
 */
function sharedNames({ before, after }: Bases) {
  if (before === SITE_MAP && after === SITE_MAP) return SITE_MAP_NAMES
  if (before === ALLOWED_PATHS && after === ALLOWED_PATHS) return ALLOWED_PATHS_NAMES
  return null
}

const basisText = (basis: RunBasis) =>
  basis === undefined ? '-' : referenceBasisLabel(basis)

const ROWS: Row[] = [
  {
    key: 'goal',
    label: () => '목표 화면 도달',
    value: (o) => (o.goalReached ? '도달' : '도달하지 못함'),
  },
  { key: 'basis', label: () => '경로 지표 기준', value: (_, basis) => basisText(basis) },
  { key: 'status', label: () => '종료 상태', value: (o) => o.status },
  { key: 'reason', label: () => '종료 사유', value: (o) => o.terminationReason ?? '-' },
  { key: 'steps', label: () => '탐색 단계 수', value: (o) => o.stepCount },
  { key: 'cost', label: () => '탐색 비용', value: (o) => o.navigationCost },
  {
    key: 'clicks',
    label: () => '성공한 이동 클릭',
    value: (o) => o.successfulNavigationClickCount,
  },
  {
    key: 'back',
    label: () => '뒤로 가기(모델 / 시스템 / 합계)',
    value: (o) => `${o.modelBackCount} / ${o.systemBackCount} / ${o.backCount}`,
  },
  {
    key: 'extra',
    label: (bases) => sharedNames(bases)?.extraSteps ?? '추가 단계',
    value: (o) => orNull(o.extraSteps),
  },
  {
    key: 'extraCost',
    label: (bases) => sharedNames(bases)?.extraNavigationCost ?? '추가 탐색 비용',
    value: (o) => orNull(o.extraNavigationCost),
  },
  {
    key: 'detour',
    // 사이트 지도 기준 Run이 있을 때만 행을 보인다. 허용 경로끼리의 비교는 기존 표시를 유지한다
    visible: ({ before, after }) => before === SITE_MAP || after === SITE_MAP,
    label: () => SITE_MAP_NAMES.detourMoveCount!,
    value: (o, basis) =>
      basis === SITE_MAP
        ? orNull(o.detourMoveCount)
        : basis === undefined
          ? '-'
          : '해당 없음',
  },
  {
    key: 'deviation',
    label: () => '기준 경로 이탈 횟수',
    value: (o, basis) =>
      basis === SITE_MAP ? '사용 안 함' : orNull(o.referencePathDeviationCount),
  },
]

/** Run 단위 비교. before/after를 나란히만 보이고 증감·화살표를 만들지 않는다(P0). 경로·검토 항목은 별도 섹션이다 */
export function RunComparison({ before, after, beforeBasis, afterBasis }: RunComparisonProps) {
  const bases: Bases = { before: beforeBasis, after: afterBasis }
  return (
    <section className="comparison-run">
      <h2>Run 단위 비교</h2>
      <div className="comparison-table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.filter((row) => row.visible?.(bases) ?? true).map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label(bases)}</th>
              <td>{row.value(before, beforeBasis)}</td>
              <td>{row.value(after, afterBasis)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
