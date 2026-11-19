import { Link } from 'react-router'
import type { ImprovementVerification, VerificationPair, VerificationRun } from '../../domain/improvement.ts'
import { comparablePair } from './verificationLinks.ts'

/** "2번 만에 도착" / "못 찾음" */
function outcome(run: VerificationRun | null): { text: string; reached: boolean | null } {
  if (!run) return { text: '기록 없음', reached: null }
  if (run.validity === 'INVALID') return { text: '판단할 수 없어요', reached: null }
  if (run.goalReached === true) return { text: run.stepCount === null ? '도착' : `${run.stepCount}번 만에 도착`, reached: true }
  if (run.goalReached === false) return { text: '못 찾음', reached: false }
  return { text: '알 수 없어요', reached: null }
}

function Side({ title, run }: { title: string; run: VerificationRun | null }) {
  const { text, reached } = outcome(run)
  return (
    <div className="imp-side" data-reached={reached === null ? undefined : String(reached)}>
      <span className="imp-side-title">{title}</span>
      <strong>{text}</strong>
    </div>
  )
}

function Pair({ pair }: { pair: VerificationPair }) {
  return (
    <>
      <div className="imp-sides">
        <Side title="지금 화면" run={pair.before} />
        <Side title="개선안" run={pair.after} />
      </div>
      {comparablePair(pair) ? <Link to={pair.comparisonPath!} className="primary-link">나란히 비교하기</Link> : null}
    </>
  )
}

/**
 * 개선안에서 AI 고객으로 다시 해 본 결과. 이 고객(`mainGoalKey`)의 결과를 크게 보이고,
 * 함께 확인한 다른 고객은 접어 둔다.
 */
export function VerificationSection({ verification, mainGoalKey }: { verification: ImprovementVerification; mainGoalKey?: string | null }) {
  if (verification.status === 'NOT_RUN') return <p className="muted">바꿀 이름이 없어서 다시 해 보지 않았어요.</p>
  const pairs = verification.pairs
  const main = pairs.find((pair) => mainGoalKey && pair.goalKey === mainGoalKey) ?? pairs[0]
  const others = pairs.filter((pair) => pair !== main)
  return (
    <div className="imp-verification">
      {verification.status === 'FAILED' ? <p role="status" className="muted">다시 해 보다가 멈췄어요. 끝난 것만 보여 드려요.</p> : null}
      {main ? <Pair pair={main} /> : <p className="muted">기록이 없어요.</p>}
      {others.length ? (
        <details className="imp-fold">
          <summary>다른 고객도 보기</summary>
          {others.map((pair, index) => (
            <section key={`${pair.goalKey ?? 'goal'}-${index}`} className="imp-other-pair" aria-label={customerName(pair)}>
              <h3>{customerName(pair)}</h3>
              <Pair pair={pair} />
            </section>
          ))}
        </details>
      ) : null}
    </div>
  )
}

const customerName = (pair: VerificationPair) => (pair.name ? `${pair.name} 고객` : '고객')
