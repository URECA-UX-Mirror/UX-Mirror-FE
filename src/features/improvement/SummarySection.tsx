import type { ImprovementReport, ImprovementScoreLine } from '../../domain/improvement.ts'
import { formatScore, formatScoreDelta } from '../../domain/improvementScore.ts'
import { quote, roOf } from './labels.ts'
import { describeReason } from './reasons.ts'

/** 부동소수점 오차로 정확히 경계인 값(−2.0%p)이 범위 밖이 되지 않게 한다 */
const EPSILON = 1e-9

const goalNamesOf = (report: ImprovementReport) => Object.fromEntries(
  [report.main, ...report.guards].flatMap((line) => (line.goalKey && line.name ? [[line.goalKey, line.name]] : [])),
)

/**
 * 끝난 결과의 결론. "'이용정보' → 'OO'으로 바꿔 보세요" 또는 "이름만 바꿔서는 나아지지 않았어요".
 * 진행 중·못 끝낸 후보는 이 카드가 아니라 `CandidateNote`로 보인다 (권하는 말을 쓰지 않는다).
 * `maxGuardLoss`(`plan.rules.maxGuardLoss`, 0~1)가 없으면 다른 고객 판정을 하지 않는다.
 */
export function SummarySection({ report, maxGuardLoss }: { report: ImprovementReport; maxGuardLoss: number | null }) {
  const improved = report.result === 'IMPROVED' && report.afterLabel !== null
  return (
    <div className="imp-conclusion">
      {improved ? (
        <p className="imp-headline">
          {report.target?.region ? <span className="imp-region">{report.target.region} </span> : null}
          {quote(report.beforeLabel)} <span aria-hidden="true">→</span> <strong>{quote(report.afterLabel!)}</strong>
          {roOf(report.afterLabel!)} 바꿔 보세요
        </p>
      ) : (
        <>
          <p className="imp-headline">
            {report.result === 'NO_IMPROVEMENT' ? '이름만 바꿔서는 나아지지 않았어요' : '이번에는 바꿀 이름을 못 정했어요'}
          </p>
          <p className="muted">
            지금은 {quote(report.beforeLabel)} 메뉴 이름만 바꿀 수 있어요.
            {report.officialRejected ? ` ${rejectedText(report)}` : ''}
          </p>
        </>
      )}

      <dl className="imp-numbers">
        <div>
          <dt>이 고객이 찾아올 가능성</dt>
          <dd>
            {improved ? <ScoreChange line={report.main} /> : <span className="imp-num">{formatScore(report.main.before)}</span>}
          </dd>
        </div>
        {improved && report.guards.length ? (
          <div>
            <dt>다른 고객</dt>
            <dd><Guards guards={report.guards} maxGuardLoss={maxGuardLoss} /></dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

/** 루프 후보가 마지막 확인에서 떨어졌을 때 한 문장 */
function rejectedText(report: ImprovementReport): string {
  const rejected = report.officialRejected!
  const who = rejected.label ? `마지막 후보 ${quote(rejected.label)}도` : '마지막 후보도'
  const why = rejected.reason ? ` (${describeReason(rejected.reason, goalNamesOf(report))})` : ''
  return `${who} 다시 재 보니 기준에 못 미쳤어요${why}.`
}

function ScoreChange({ line }: { line: ImprovementScoreLine }) {
  return (
    <span className="imp-num">
      {formatScore(line.before)} <span aria-hidden="true">→</span> <strong>{formatScore(line.after)}</strong>
      <span className="imp-delta" data-negative={(line.delta ?? 0) < 0}>{formatScoreDelta(line.delta)}</span>
    </span>
  )
}

function Guards({ guards, maxGuardLoss }: { guards: ImprovementScoreLine[]; maxGuardLoss: number | null }) {
  const dropped = (line: ImprovementScoreLine) =>
    maxGuardLoss !== null && line.delta !== null && line.delta < -maxGuardLoss - EPSILON
  const verdict = maxGuardLoss === null ? '점수 보기' : guards.some(dropped) ? '많이 떨어졌어요' : '괜찮아요'
  return (
    <details className="imp-guards">
      <summary data-bad={verdict === '많이 떨어졌어요'}>{verdict}</summary>
      <ul>
        {guards.map((line, index) => (
          <li key={line.goalKey ?? index}>
            <span>{line.name ? `${line.name} 고객` : '고객'}</span> <ScoreChange line={line} />
            {dropped(line) ? <span className="imp-bad"> 많이 떨어졌어요</span> : null}
          </li>
        ))}
      </ul>
      {maxGuardLoss !== null ? (
        <p className="muted">{formatScoreDelta(-maxGuardLoss)}까지는 괜찮다고 봐요.</p>
      ) : null}
    </details>
  )
}

/**
 * 아직 확정이 아닌 후보 (진행 중이거나 끝내지 못함). "바꿔 보세요"라고 권하지 않는다.
 * 루프가 찾은 후보가 없으면 아무것도 보이지 않는다.
 */
export function CandidateNote({ report, stage }: { report: ImprovementReport; stage: 'pending' | 'unfinished' }) {
  if (report.result !== 'IMPROVED' || report.afterLabel === null) return null
  return (
    <div className="imp-candidate" role="status">
      <p>
        지금까지 찾은 이름: {quote(report.beforeLabel)} <span aria-hidden="true">→</span> <strong>{quote(report.afterLabel)}</strong>
      </p>
      <p className="muted">
        {stage === 'pending' ? '아직 확정 아니에요. 다시 확인하면서 바뀔 수 있어요.' : '확인을 끝내지 못해 확정 아니에요. 이 이름은 권하지 않아요.'}
      </p>
    </div>
  )
}
