import type { ImprovementCandidate, ImprovementGoal, ImprovementRound, ImprovementStop } from '../../domain/improvement.ts'
import { formatScore } from '../../domain/improvementScore.ts'
import { eulOf, quote } from './labels.ts'
import { describeReason } from './reasons.ts'

type Props = { rounds: ImprovementRound[]; stop: ImprovementStop | null; goals: ImprovementGoal[] }

/** 후보의 찾아올 가능성. 점수를 못 냈으면 0%가 아니라 이유를 보인다 */
function candidateScore(c: ImprovementCandidate): string {
  if (c.mainScore !== null) return formatScore(c.mainScore)
  if (c.evaluationStatus === 'FAILED') return '점수 못 냄'
  if (c.evaluationStatus === 'SKIPPED') return '안 해 봄'
  return '점수 없음'
}

function verdict(c: ImprovementCandidate, adopted: boolean, goals: Record<string, string>): string {
  if (adopted) return '골랐어요'
  if (c.reason) return describeReason(c.reason, goals)
  return c.decision === 'REJECTED' ? '안 골랐어요' : ''
}

/** 이름 후보를 몇 번에 걸쳐 시험했는지. "어떻게 골랐는지 보기" 안에 들어간다 */
export function RoundsSection({ rounds, stop, goals: goalList }: Props) {
  const goals = Object.fromEntries(goalList.filter((goal) => goal.name).map((goal) => [goal.goalKey, goal.name!]))
  return (
    <section className="imp-rounds" aria-label="시험한 이름">
      <h3>시험한 이름 ({rounds.length}번 시도)</h3>
      {rounds.map((round) => {
        const filtered = round.proposal.filter((item) => !item.accepted)
        return (
          <section className="imp-round" key={round.round} aria-label={`${round.round}번째 시도`}>
            <h4>{round.round}번째 시도</h4>
            {round.diagnosis?.targetButton?.label && round.diagnosis.rivalButton?.label ? (
              <p>고객이 {quote(round.diagnosis.targetButton.label)} 대신 {quote(round.diagnosis.rivalButton.label)}{eulOf(round.diagnosis.rivalButton.label)} 더 많이 눌렀어요.</p>
            ) : null}
            {round.baseline?.label ? (
              <p className="muted">시작 이름 {quote(round.baseline.label)} · {formatScore(round.baseline.mainScore)}</p>
            ) : null}
            <ul className="imp-candidates">
              {round.candidates.map((c) => {
                const adopted = c.candidateId === round.adopted
                return (
                  <li key={c.candidateId} data-adopted={adopted}>
                    <span className="imp-candidate-name">{quote(c.label)}{c.source === 'HUMAN' ? <span className="muted"> · 사람이 낸 이름</span> : null}</span>
                    <span className="imp-num">{candidateScore(c)}</span>
                    <span className="imp-verdict">{verdict(c, adopted, goals)}</span>
                  </li>
                )
              })}
            </ul>
            {round.adopted === null ? <p className="muted">이번 시도에서는 고른 이름이 없어요.</p> : null}
            {filtered.length ? (
              <p className="muted">
                미리 걸러낸 이름: {filtered.map((item) => `${quote(item.label)}${item.rejectedReason ? ` (${describeReason(item.rejectedReason, goals)})` : ''}`).join(', ')}
              </p>
            ) : null}
          </section>
        )
      })}
      {stop?.reason ? <p className="muted">멈춘 이유: {describeReason(stop.reason, goals)}</p> : null}
    </section>
  )
}
