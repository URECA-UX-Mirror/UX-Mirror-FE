import type { ReactNode } from 'react'
import type { RunOutcome } from '../../domain/types.ts'

interface RunComparisonProps {
  before: RunOutcome
  after: RunOutcome
}

const orNull = (value: number | null) =>
  value === null ? '계산 불가' : value

interface Row {
  label: string
  value: (outcome: RunOutcome) => ReactNode
}

const ISSUE_TYPES: { type: string; label: string }[] = [
  { type: 'CHOICE_AMBIGUITY', label: '선택 모호성' },
  { type: 'REFERENCE_PATH_DEVIATION', label: '기준 경로 이탈' },
  { type: 'REPEATED_VISIT', label: '반복 방문' },
  { type: 'EXTRA_STEPS', label: '추가 단계' },
  { type: 'GOAL_NOT_REACHED', label: '목표 화면 미도달' },
]

const ROWS: Row[] = [
  {
    label: '목표 화면 도달',
    value: (o) => (o.goalReached ? '도달' : '도달하지 못함'),
  },
  { label: '종료 상태', value: (o) => o.status },
  { label: '종료 사유', value: (o) => o.terminationReason ?? '-' },
  { label: '탐색 단계 수', value: (o) => o.stepCount },
  { label: '탐색 비용', value: (o) => o.navigationCost },
  {
    label: '성공한 이동 클릭',
    value: (o) => o.successfulNavigationClickCount,
  },
  {
    label: '뒤로 가기(모델 / 시스템 / 합계)',
    value: (o) => `${o.modelBackCount} / ${o.systemBackCount} / ${o.backCount}`,
  },
  { label: '추가 단계', value: (o) => orNull(o.extraSteps) },
  { label: '추가 탐색 비용', value: (o) => orNull(o.extraNavigationCost) },
  {
    label: '기준 경로 이탈 횟수',
    value: (o) => o.referencePathDeviationCount,
  },
  {
    label: '탐색 경로',
    value: (o) =>
      o.path.length === 0 ? (
        '-'
      ) : (
        <ol className="path-list">
          {o.path.map((visit) => (
            <li key={visit.sequence}>
              {visit.pageKey} <span className="muted">({visit.path})</span>
            </li>
          ))}
        </ol>
      ),
  },
]

/** Run 단위 비교. before/after를 나란히만 보이고 증감·화살표를 만들지 않는다(P0). */
export function RunComparison({ before, after }: RunComparisonProps) {
  return (
    <section className="comparison-run">
      <h2>Run 단위 비교</h2>
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
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value(before)}</td>
              <td>{row.value(after)}</td>
            </tr>
          ))}
          {ISSUE_TYPES.map(({ type, label }) => (
            <tr key={type}>
              <th scope="row">검토 후보: {label}</th>
              <td>
                {before.detectedIssueTypes.includes(type)
                  ? '탐지됨'
                  : '탐지되지 않음'}
              </td>
              <td>
                {after.detectedIssueTypes.includes(type)
                  ? '탐지됨'
                  : '탐지되지 않음'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
