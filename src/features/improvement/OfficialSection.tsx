import type { ImprovementOfficial } from '../../domain/improvement.ts'
import { formatScore, formatScoreDelta } from '../../domain/improvementScore.ts'

interface OfficialSectionProps {
  /** `null`이면 공식 평가 전이다 */
  official: ImprovementOfficial | null
  /** 목표 키(`S1` 등) → 이름. 없으면 키만 보인다 */
  goalNames?: Record<string, string>
}

const BUILD_CHECK_LABELS: Record<string, string> = {
  ONLY_LABEL_DIFF: '이름 외 차이 없음',
}

export function OfficialSection({ official, goalNames = {} }: OfficialSectionProps) {
  if (official === null) {
    return <p className="summary-muted">공식 평가 결과 없음</p>
  }
  const { scores, scoresA, maxDiffAvsB, buildCheck } = official
  const guardKeys = Object.keys(scores.guardScores)
  const nameOf = (key: string) => (goalNames[key] ? `${key} ${goalNames[key]}` : key)

  return (
    <div className="official-section">
      <p>
        공식 평가 최종안 <strong>{official.label}</strong>
        {official.method ? <span className="summary-muted"> (방식 {official.method})</span> : null}
      </p>
      <ul className="summary-lines">
        <li className="summary-score-line">
          <span className="summary-score-name">주 목표 점수</span>
          <strong>{formatScore(scores.mainScore)}</strong>
        </li>
        {guardKeys.map((key) => (
          <li key={key} className="summary-score-line">
            <span className="summary-score-name">{nameOf(key)}</span>
            <strong>{formatScore(scores.guardScores[key])}</strong>
          </li>
        ))}
      </ul>
      {buildCheck ? (
        <p className="summary-muted">
          사이트 확인: {BUILD_CHECK_LABELS[buildCheck] ?? buildCheck}
        </p>
      ) : null}
      {scoresA && maxDiffAvsB !== null ? (
        <p className="summary-muted">
          추정(A)과 공식(B)의 차이: 최대 {formatScoreDelta(maxDiffAvsB)} (A 주 목표 {formatScore(scoresA.mainScore)})
        </p>
      ) : null}
    </div>
  )
}
