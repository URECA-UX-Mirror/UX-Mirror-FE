import { Link } from 'react-router'
import type { Comparison, RunOutcome } from '../../domain/types.ts'
import { pageName, SIDE_NAMES, type Side } from './labels.ts'
import type { RunMeta } from './useComparisonData.ts'
import { outcomeText, verdictText } from './verdict.ts'

const SIDES: Side[] = ['before', 'after']

interface SummaryProps {
  comparison: Comparison
  meta: Record<Side, RunMeta>
}

const runIdOf = (comparison: Comparison, side: Side) =>
  side === 'before' ? comparison.beforeRunId : comparison.afterRunId

/** 한 문장 결론과 두 쪽 결과. 설정이 다르면 결론 대신 이유 한 문장을 보인다 */
export function ComparisonSummary({ comparison, meta }: SummaryProps) {
  const verdict = verdictText(comparison)
  return (
    <section className="comparison-summary" aria-label="결과 요약">
      {verdict ? <p className="comparison-verdict">{verdict}</p> : null}
      {comparison.conditionsMatched ? null : (
        <p className="comparison-note" role="status">
          두 진단의 설정이 달라서 결과를 바로 견주기 어려워요.{' '}
          <Link to={`/?experimentKey=${encodeURIComponent(comparison.experimentKey)}`}>다시 진단하기</Link>
        </p>
      )}
      <div className="comparison-sides">
        {SIDES.map((side) => {
          const runId = runIdOf(comparison, side)
          const { menuLabel } = meta[side]
          return (
            <div key={side} className="comparison-side" data-side={side}>
              <h2 className="side-tag" data-side={side}>
                {SIDE_NAMES[side]}
              </h2>
              <p className="comparison-side-result">{outcomeText(comparison.runComparison[side])}</p>
              {menuLabel ? <p className="muted">메뉴 이름 ‘{menuLabel}’</p> : null}
              <Link to={`/runs/${encodeURIComponent(runId)}`} aria-label={`${SIDE_NAMES[side]} 진단 보기`}>
                진단 보기
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PathList({ outcome }: { outcome: RunOutcome }) {
  if (outcome.path.length === 0) return <p className="muted">기록이 없어요</p>
  return (
    <ol className="path-chain">
      {outcome.path.map((visit) => (
        <li key={visit.sequence} data-back={visit.enteredBy === 'GO_BACK' ? 'true' : undefined}>
          {pageName(visit.pageKey)}
          {visit.enteredBy === 'GO_BACK' ? <small> (뒤로)</small> : null}
        </li>
      ))}
    </ol>
  )
}

/** 지나간 길. 두 쪽이 들른 화면을 순서대로 나란히 보인다 */
export function PathComparison({ comparison }: { comparison: Comparison }) {
  return (
    <section className="comparison-paths" aria-labelledby="comparison-paths-title">
      <h2 id="comparison-paths-title">지나간 길</h2>
      <div className="comparison-sides">
        {SIDES.map((side) => (
          <div key={side} className="comparison-path" aria-label={`${SIDE_NAMES[side]} 길`}>
            <span className="side-tag" data-side={side}>
              {SIDE_NAMES[side]}
            </span>
            <PathList outcome={comparison.runComparison[side]} />
          </div>
        ))}
      </div>
    </section>
  )
}
