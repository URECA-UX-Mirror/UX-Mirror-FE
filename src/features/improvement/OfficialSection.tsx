import type { ImprovementOfficial } from '../../domain/improvement.ts'
import { formatScore, formatScoreMagnitude } from '../../domain/improvementScore.ts'
import { describeReason } from './reasons.ts'

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

  // `decision`이 없으면 옛 형식이라 확정으로 본다. `REJECTED`는 B 평가에서 탈락한 이름이다
  const rejected = official.decision === 'REJECTED'
  const unknownDecision =
    official.decision !== null && official.decision !== 'CONFIRMED' && !rejected
      ? official.decision
      : null

  return (
    <div className="official-section">
      <p>
        {rejected ? '공식 평가에서 탈락한 이름 ' : '공식 평가 최종안 '}
        <strong>{official.label}</strong>
        {official.method ? <span className="summary-muted"> (방식 {official.method})</span> : null}
        {unknownDecision ? <span className="summary-muted"> (판정 {unknownDecision})</span> : null}
      </p>
      {rejected ? (
        <p className="summary-rejected">
          {official.rejectedReason
            ? `탈락 사유: ${describeReason(official.rejectedReason, goalNames)} (${official.rejectedReason})`
            : '탈락 사유를 알 수 없음'}
        </p>
      ) : null}
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
          추정(A)과 공식(B)의 차이: 최대 {formatScoreMagnitude(maxDiffAvsB)} (A 주 목표 {formatScore(scoresA.mainScore)})
        </p>
      ) : null}
    </div>
  )
}
