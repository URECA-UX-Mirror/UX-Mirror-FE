import type { ImprovementReport, ImprovementScoreLine } from '../../domain/improvement.ts'
import { formatScore, formatScoreDelta, SCORE_NULL_TEXT } from '../../domain/improvementScore.ts'
import { describeReason } from './reasons.ts'

interface SummarySectionProps {
  report: ImprovementReport
  /** `plan.rules.maxGuardLoss`(0~1). 없으면 허용 범위 판정을 하지 않는다 */
  maxGuardLoss: number | null
}

/** 점수 출처. 모르는 값은 원문으로 보인다 */
const SCORE_SOURCE_LABELS: Record<string, string> = {
  OFFICIAL_B: '공식 평가(B) 점수',
}

const SOURCE_LABELS: Record<string, string> = { AI: 'AI 제안', HUMAN: '사람 제안' }

/** 부동소수점 오차로 정확히 경계인 값(−2.0%p)이 범위 밖이 되지 않게 한다 */
const EPSILON = 1e-9

export function SummarySection({ report, maxGuardLoss }: SummarySectionProps) {
  const improved = report.result === 'IMPROVED'
  const rejected = report.result === 'NO_IMPROVEMENT'
  const headline = report.headline
  const goalNames = Object.fromEntries(
    [report.main, ...report.guards].flatMap((line) => (line.goalKey && line.name ? [[line.goalKey, line.name]] : [])),
  )
  const scoreSource = report.scoreSource
    ? (SCORE_SOURCE_LABELS[report.scoreSource] ?? report.scoreSource)
    : null

  return (
    <div className="summary-section">
      {headline ? <p className="summary-headline">{headline}</p> : null}

      <div className="summary-block">
        <h3>무엇을 바꾸면 되나</h3>
        {!improved ? (
          <p className="summary-rejected">
            {/* 모르는 result 값도 사용자 말로 보이고, 후 값은 `NO_IMPROVEMENT`처럼 숨긴다 */}
            {rejected ? `이 목표는 "${report.beforeLabel}" 이름만 바꿔서는 좋아지지 않았어요.` : '이번 실행에서는 바꿀 이름을 정하지 못했어요.'}
            <span className="summary-muted"> 지금은 상단 메뉴 "{report.beforeLabel}" 자리만 바꿀 수 있어요.</span>
            {report.officialRejected ? (
              <span className="summary-muted">
                {' '}
                · 개선안 화면에서 다시 재 보니 {report.officialRejected.label ? `"${report.officialRejected.label}"` : '후보'}도 기준을 넘지 못했어요
                {report.officialRejected.reason
                  ? ` (${describeReason(report.officialRejected.reason, goalNames)})`
                  : ''}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="summary-hero">
            {report.target?.region ? <span className="summary-region">{report.target.region} </span> : null}
            "<span>{report.beforeLabel}</span>"
            <span aria-hidden="true"> → </span>
            "<strong>{report.afterLabel ?? SCORE_NULL_TEXT}</strong>"(으)로 바꿔 보세요
            {report.afterSource ? (
              <span className="summary-source">
                {SOURCE_LABELS[report.afterSource] ?? '제안'}
              </span>
            ) : null}
          </p>
        )}

      </div>

      <div className="summary-block">
        <h3>가장 짧은 길로 찾아올 가능성</h3>
        <ScoreLine line={report.main} improved={improved} kind="main" />
        {scoreSource && improved ? (
          <p className="summary-muted">{scoreSource === '공식 평가(B) 점수' ? '개선안 화면에서 다시 잰 값이에요' : ''}</p>
        ) : null}
      </div>

      <div className="summary-block">
        <h3>다른 고객은 괜찮나</h3>
        {maxGuardLoss !== null ? (
          <p className="summary-muted">
            지금 화면보다 {formatScoreDelta(-maxGuardLoss)}까지만 떨어져도 괜찮다고 봐요
          </p>
        ) : null}
        {report.guards.length === 0 ? (
          <p className="summary-muted">함께 살펴본 다른 고객이 없어요</p>
        ) : (
          <ul className="summary-lines">
            {report.guards.map((guard, index) => (
              <li key={guard.goalKey ?? index}>
                <ScoreLine
                  line={guard}
                  improved={improved}
                  kind="guard"
                  maxGuardLoss={maxGuardLoss}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface ScoreLineProps {
  line: ImprovementScoreLine
  improved: boolean
  kind: 'main' | 'guard'
  maxGuardLoss?: number | null
}

function ScoreLine({ line, improved, kind, maxGuardLoss = null }: ScoreLineProps) {
  const name = line.name ? `${line.name}${kind === 'main' ? '하려는 고객' : ' 고객'}` : '고객'
  // 개선안이 없으면 후 점수·변화량은 보이지 않는다(`NO_IMPROVEMENT`)
  const showAfter = improved
  const outOfRange =
    kind === 'guard' &&
    showAfter &&
    maxGuardLoss !== null &&
    line.delta !== null &&
    line.delta < -maxGuardLoss - EPSILON
  return (
    <div className="summary-score-line">
      <span className="summary-score-name">{name || '목표'}</span>
      <span className="summary-score-values">
        <span>{formatScore(line.before)}</span>
        {showAfter ? (
          <>
            <span aria-hidden="true"> → </span>
            <strong>{formatScore(line.after)}</strong>
            <span className="summary-delta" data-negative={(line.delta ?? 0) < 0}>
              {formatScoreDelta(line.delta)}
            </span>
          </>
        ) : null}
      </span>
      {kind === 'guard' && showAfter && maxGuardLoss !== null && line.delta !== null ? (
        <span className={outOfRange ? 'summary-range-out' : 'summary-range-ok'}>
          {outOfRange ? '너무 많이 떨어짐' : '괜찮음'}
        </span>
      ) : null}
    </div>
  )
}
