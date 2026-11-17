import type { ReactNode } from 'react'
import { referenceBasisLabel } from '../../domain/referenceBasis.ts'
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
  label: (bases: Bases) => string
  value: (outcome: RunOutcome, basis: RunBasis) => ReactNode
}

interface Bases {
  before: RunBasis
  after: RunBasis
}

const SITE_MAP = 'SITE_MAP'
const NO_BASES: Bases = { before: undefined, after: undefined }

/** 양쪽이 사이트 지도 기준일 때만 "최단 경로 대비" 이름을 쓴다. 허용 경로(과거 Run 포함)는 기존 이름을 유지한다 */
const bothSiteMap = ({ before, after }: Bases) =>
  before === SITE_MAP && after === SITE_MAP

const basisText = (basis: RunBasis) =>
  basis === undefined ? '-' : referenceBasisLabel(basis)

const ROWS: Row[] = [
  {
    label: () => '목표 화면 도달',
    value: (o) => (o.goalReached ? '도달' : '도달하지 못함'),
  },
  { label: () => '경로 지표 기준', value: (_, basis) => basisText(basis) },
  { label: () => '종료 상태', value: (o) => o.status },
  { label: () => '종료 사유', value: (o) => o.terminationReason ?? '-' },
  { label: () => '탐색 단계 수', value: (o) => o.stepCount },
  { label: () => '탐색 비용', value: (o) => o.navigationCost },
  {
    label: () => '성공한 이동 클릭',
    value: (o) => o.successfulNavigationClickCount,
  },
  {
    label: () => '뒤로 가기(모델 / 시스템 / 합계)',
    value: (o) => `${o.modelBackCount} / ${o.systemBackCount} / ${o.backCount}`,
  },
  {
    label: (bases) => (bothSiteMap(bases) ? '최단 경로 대비 추가 단계' : '추가 단계'),
    value: (o) => orNull(o.extraSteps),
  },
  {
    label: (bases) =>
      bothSiteMap(bases) ? '최단 경로 대비 추가 탐색 비용' : '추가 탐색 비용',
    value: (o) => orNull(o.extraNavigationCost),
  },
  {
    label: () => '우회 이동',
    // 사이트 지도 기준에서만 의미가 있다. 다른 기준은 값을 만들지 않는다
    value: (o, basis) =>
      basis === SITE_MAP || basis === undefined ? orNull(o.detourMoveCount) : '해당 없음',
  },
  {
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
          {ROWS.map((row) => (
            <tr key={row.label(NO_BASES)}>
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
