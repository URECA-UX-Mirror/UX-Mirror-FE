import type { ImprovementReport, ImprovementScoreLine } from '../../domain/improvement.ts'
import { formatScore, formatScoreDelta, SCORE_NULL_TEXT } from '../../domain/improvementScore.ts'

interface SummarySectionProps {
  report: ImprovementReport
  /** `plan.rules.guardMaxDrop`(0~1). 없으면 허용 범위 판정을 하지 않는다 */
  guardMaxDrop: number | null
}

/** 점수 출처. 모르는 값은 원문으로 보인다 */
const SCORE_SOURCE_LABELS: Record<string, string> = {
  OFFICIAL_B: '공식 평가(B) 점수',
}

const SOURCE_LABELS: Record<string, string> = { AI: 'AI 제안', HUMAN: '사람 제안' }

/** 부동소수점 오차로 정확히 경계인 값(−2.0%p)이 범위 밖이 되지 않게 한다 */
const EPSILON = 1e-9

/** 샘플 배지와 겹치지 않도록 headline 끝의 `(샘플)`을 뗀다 */
function headlineText(headline: string | null, sample: boolean): string | null {
  if (headline === null) return null
  return sample ? headline.replace(/\s*\(샘플\)\s*$/, '') : headline
}

export function SummarySection({ report, guardMaxDrop }: SummarySectionProps) {
  const improved = report.result === 'IMPROVED'
  const rejected = report.result === 'NO_IMPROVEMENT'
  const headline = headlineText(report.headline, report.sample)
  const scoreSource = report.scoreSource
    ? (SCORE_SOURCE_LABELS[report.scoreSource] ?? report.scoreSource)
    : null

  return (
    <div className="summary-section">
      {headline ? <p className="summary-headline">{headline}</p> : null}

      <div className="summary-block">
        <h3>무엇을 바꿨나</h3>
        {!improved ? (
          <p className="summary-rejected">
            {/* 모르는 result 값은 원문으로 보이고, 후 값은 `NO_IMPROVEMENT`처럼 숨긴다 */}
            {rejected ? '개선안 미채택' : `알 수 없는 결과: ${report.result}`}
            <span className="summary-muted"> · 현재 이름: {report.beforeLabel}</span>
          </p>
        ) : (
          <p>
            {report.target?.region ? (
              <span className="summary-region">{report.target.region} · </span>
            ) : null}
            <span>{report.beforeLabel}</span>
            <span aria-hidden="true"> → </span>
            <strong>{report.afterLabel ?? SCORE_NULL_TEXT}</strong>
            {report.afterSource ? (
              <span className="summary-source">
                {SOURCE_LABELS[report.afterSource] ?? report.afterSource}
              </span>
            ) : null}
          </p>
        )}
        {!improved && report.target?.region ? (
          <p className="summary-muted">대상 위치: {report.target.region}</p>
        ) : null}
      </div>

      <div className="summary-block">
        <h3>얼마나 좋아졌나</h3>
        <ScoreLine line={report.main} improved={improved} kind="main" />
        {scoreSource && improved ? (
          <p className="summary-muted">점수 출처: {scoreSource}</p>
        ) : null}
      </div>

      <div className="summary-block">
        <h3>다른 목표는 유지됐나</h3>
        {guardMaxDrop !== null ? (
          <p className="summary-muted">
            허용 감소 범위: 최초 v1 대비 {formatScoreDelta(-guardMaxDrop)} 이내
          </p>
        ) : null}
        {report.guards.length === 0 ? (
          <p className="summary-muted">지킬 목표 없음</p>
        ) : (
          <ul className="summary-lines">
            {report.guards.map((guard, index) => (
              <li key={guard.goalKey ?? index}>
                <ScoreLine
                  line={guard}
                  improved={improved}
                  kind="guard"
                  guardMaxDrop={guardMaxDrop}
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
  guardMaxDrop?: number | null
}

function ScoreLine({ line, improved, kind, guardMaxDrop = null }: ScoreLineProps) {
  const name = [line.goalKey, line.name].filter(Boolean).join(' ')
  // 개선안이 없으면 후 점수·변화량은 보이지 않는다(`NO_IMPROVEMENT`)
  const showAfter = improved
  const outOfRange =
    kind === 'guard' &&
    showAfter &&
    guardMaxDrop !== null &&
    line.delta !== null &&
    line.delta < -guardMaxDrop - EPSILON
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
      {kind === 'guard' && showAfter && guardMaxDrop !== null && line.delta !== null ? (
        <span className={outOfRange ? 'summary-range-out' : 'summary-range-ok'}>
          {outOfRange ? '허용 범위 초과' : '허용 범위 이내'}
        </span>
      ) : null}
    </div>
  )
}
