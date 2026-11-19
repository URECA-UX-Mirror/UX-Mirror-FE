import type {
  GuardScores,
  ImprovementButton,
  ImprovementCandidate,
  ImprovementGoal,
  ImprovementRound,
  ImprovementStop,
} from '../../domain/improvement.ts'
import { formatScore, SCORE_NULL_TEXT } from '../../domain/improvementScore.ts'
import { describeReason } from './reasons.ts'

type Props = { rounds: ImprovementRound[]; stop: ImprovementStop | null; goals: ImprovementGoal[] }

function scoreForCandidate(value: number | null, status: string | null) {
  if (value !== null) return formatScore(value)
  if (status === 'FAILED') return '평가 실패'
  if (status === 'SKIPPED') return '미실행'
  return SCORE_NULL_TEXT
}

const goalName = (key: string, goals: Record<string, string>) =>
  goals[key] ? `${goals[key]}(${key})` : key

function guards(values: GuardScores | null, goals: Record<string, string>, empty = SCORE_NULL_TEXT) {
  return values && Object.keys(values).length
    ? Object.entries(values).map(([key, value]) => `${goalName(key, goals)} ${formatScore(value)}`).join(' · ')
    : empty
}

function reason(code: string | null, goals: Record<string, string>) {
  if (!code) return '값 없음'
  const description = describeReason(code, goals)
  return description === code ? code : `${description} (${code})`
}

function button(button: ImprovementButton | null) {
  return button ? `${button.label ?? '값 없음'} · 선택 확률 ${formatScore(button.probability)}` : '값 없음'
}

function Candidate({ candidate: c, adopted, goals }: {
  candidate: ImprovementCandidate
  adopted: boolean
  goals: Record<string, string>
}) {
  const missing = scoreForCandidate(null, c.evaluationStatus)
  const source = c.source === 'HUMAN' ? '사람' : c.source === 'AI' ? 'AI' : c.source ?? '값 없음'
  const status = c.evaluationStatus === 'COMPLETED' ? '평가 완료'
    : c.evaluationStatus === 'FAILED' ? '평가 실패'
      : c.evaluationStatus === 'SKIPPED' ? '미실행' : c.evaluationStatus ?? '값 없음'
  const decision = c.decision === 'ADOPTED' ? '채택' : c.decision === 'REJECTED' ? '탈락' : c.decision
  const layout = c.layoutValid === null ? '값 없음' : c.layoutValid ? '통과' : '실패'

  return (
    <article className={`round-candidate${adopted ? ' is-adopted' : ''}`}>
      <h5>
        {c.candidateId} · {c.label} <span className="round-source">{source}</span>
        {adopted ? ' · 채택' : null}
      </h5>
      <dl className="round-details">
        <div><dt>순서</dt><dd>{c.order ?? '값 없음'}</dd></div>
        <div><dt>평가 방식</dt><dd>{c.method ?? '값 없음'}</dd></div>
        <div><dt>평가 상태</dt><dd>{status}</dd></div>
        <div>
          <dt>화면 검사</dt>
          <dd>
            {layout}
            {c.layoutReasons.length ? ` · ${c.layoutReasons.map((item) => reason(item, goals)).join(', ')}` : ''}
          </dd>
        </div>
        <div><dt>주 점수</dt><dd>{scoreForCandidate(c.mainScore, c.evaluationStatus)}</dd></div>
        <div><dt>지킬 점수</dt><dd>{guards(c.guardScores, goals, missing)}</dd></div>
        <div><dt>판정</dt><dd>{decision}</dd></div>
        <div><dt>사유</dt><dd>{reason(c.reason, goals)}</dd></div>
      </dl>
    </article>
  )
}

export function RoundsSection({ rounds, stop, goals: goalList }: Props) {
  const goals = Object.fromEntries(goalList.filter((goal) => goal.name).map((goal) => [goal.goalKey, goal.name!]))
  const lastAdopted = [...rounds].reverse().flatMap((round) =>
    round.candidates.filter((candidate) => candidate.candidateId === round.adopted),
  )[0]

  return (
    <section className="card improvement-area" aria-label="개선 회차">
      <details>
        <summary>
          <strong>개선 회차</strong> · {rounds.length}회차 진행, 채택 안: {lastAdopted?.label ?? '없음'}
        </summary>
        {rounds.map((round) => (
          <section className="improvement-round" key={round.round}>
            <h3>{round.round}회차</h3>
            {round.diagnosis ? (
              <div>
                <h4>진단</h4>
                {round.diagnosis.text ? <p>{round.diagnosis.text}</p> : null}
                <p>막힌 화면: {round.diagnosis.bottleneckPage ?? '값 없음'}</p>
                <p>고칠 버튼: {button(round.diagnosis.targetButton)} / 경쟁 버튼: {button(round.diagnosis.rivalButton)}</p>
              </div>
            ) : null}
            {round.baseline ? (
              <div>
                <h4>현재 기준</h4>
                <p>
                  {round.baseline.label ?? '값 없음'} · 주 점수 {formatScore(round.baseline.mainScore)}
                  {' · 지킬 점수 '}{guards(round.baseline.guardScores, goals)}
                </p>
              </div>
            ) : null}
            <div>
              <h4>제안 필터</h4>
              {[true, false].map((accepted) => (
                <p key={String(accepted)}>
                  {accepted ? '통과' : '탈락'}:{' '}
                  {round.proposal.filter((item) => item.accepted === accepted)
                    .map((item) => accepted ? item.label : `${item.label} — ${reason(item.rejectedReason, goals)}`)
                    .join(' · ') || '없음'}
                </p>
              ))}
            </div>
            <h4>후보 평가</h4>
            {round.adopted === null ? <p>이 회차는 채택 없음</p> : null}
            <div className="round-candidates">
              {round.candidates.map((candidate) => (
                <Candidate key={candidate.candidateId} candidate={candidate}
                  adopted={candidate.candidateId === round.adopted} goals={goals} />
              ))}
            </div>
          </section>
        ))}
        {stop ? (
          <div className="round-stop">
            <h3>종료 사유</h3>
            <p>{stop.reason ? reason(stop.reason, goals) : '값 없음'}</p>
            {stop.detail ? <p>{stop.detail}</p> : null}
          </div>
        ) : null}
      </details>
    </section>
  )
}
