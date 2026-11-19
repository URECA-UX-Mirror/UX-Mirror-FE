import type { ImprovementOfficial } from '../../domain/improvement.ts'
import { formatScore, formatScoreMagnitude } from '../../domain/improvementScore.ts'
import { quote } from './labels.ts'
import { describeReason } from './reasons.ts'

/**
 * 점수 계산: 개선안 화면을 실제로 만든 뒤 다시 잰 점수(BE 공식 평가 B). "어떻게 골랐는지 보기" 안에 들어간다.
 * `goalNames`: 목표 키(`S1` 등) → 이름. 이름을 모르면 "다른 고객"으로 보인다.
 */
export function OfficialSection({ official, goalNames = {} }: {
  official: ImprovementOfficial
  goalNames?: Record<string, string>
}) {
  const { scores, scoresA, maxDiffAvsB, buildCheck } = official
  // `decision`이 없으면 옛 형식이라 확정으로 본다. `REJECTED`는 마지막 확인에서 떨어진 이름이다
  const rejected = official.decision === 'REJECTED'
  const unknownDecision = official.decision !== null && official.decision !== 'CONFIRMED' && !rejected
  const guardKeys = Object.keys(scores.guardScores)

  return (
    <section className="imp-official" aria-label="점수 계산">
      <h3>점수 계산</h3>
      <p className="muted">개선안 화면을 만들어 다시 잰 점수예요.</p>
      <p>
        {quote(official.label)} · {rejected ? '떨어졌어요' : unknownDecision ? '확정인지 확인이 필요해요' : '확정'}
        {rejected ? ` (${official.rejectedReason ? describeReason(official.rejectedReason, goalNames) : '이유를 알 수 없어요'})` : ''}
      </p>
      <ul className="imp-score-list">
        <li><span>이 고객</span><strong className="imp-num">{formatScore(scores.mainScore)}</strong></li>
        {guardKeys.map((key) => (
          <li key={key}>
            <span>{goalNames[key] ? `${goalNames[key]} 고객` : '다른 고객'}</span>
            <strong className="imp-num">{formatScore(scores.guardScores[key])}</strong>
          </li>
        ))}
      </ul>
      {buildCheck ? (
        <p className="muted">{buildCheck === 'ONLY_LABEL_DIFF' ? '메뉴 이름 말고는 바뀐 게 없어요.' : '이름 말고 바뀐 게 있는지 확인이 필요해요.'}</p>
      ) : null}
      {scoresA && maxDiffAvsB !== null ? (
        <p className="muted">미리 계산한 점수와 차이: 최대 {formatScoreMagnitude(maxDiffAvsB)}</p>
      ) : null}
    </section>
  )
}
