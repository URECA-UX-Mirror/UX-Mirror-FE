import { Link } from 'react-router'
import type { ImprovementVerification, VerificationPair, VerificationRun } from '../../domain/improvement.ts'
import { Disclosure } from '../../shared/Timeline.tsx'
import { comparablePair } from './verificationLinks.ts'

/** "2번 만에 도착" / "못 찾음" */
function outcome(run: VerificationRun | null): { text: string; reached: boolean | null } {
  if (!run) return { text: '기록 없음', reached: null }
  if (run.validity === 'INVALID') return { text: '판단할 수 없어요', reached: null }
  if (run.goalReached === true) return { text: run.stepCount === null ? '도착' : `${run.stepCount}번 만에 도착`, reached: true }
  if (run.goalReached === false) return { text: '못 찾음', reached: false }
  return { text: '알 수 없어요', reached: null }
}

function Row({ title, run }: { title: string; run: VerificationRun | null }) {
  const { text, reached } = outcome(run)
  return (
    <div className="recheck-row" data-reached={reached === null ? undefined : String(reached)}>
      <dt>{title}</dt>
      <dd>{text}</dd>
    </div>
  )
}

function Pair({ pair }: { pair: VerificationPair }) {
  return (
    <>
      <dl className="recheck">
        <Row title="지금 화면" run={pair.before} />
        <Row title="개선안" run={pair.after} />
      </dl>
      {comparablePair(pair) ? <Link to={pair.comparisonPath!}>화면별로 비교하기</Link> : null}
    </>
  )
}

/**
 * 개선안 화면에서 AI가 다시 해 본 결과. 이번 목표(`mainGoalKey`)를 두 줄로 보이고,
 * 함께 확인한 다른 목표는 접어 둔다.
 */
export function VerificationSection({ verification, mainGoalKey }: { verification: ImprovementVerification; mainGoalKey?: string | null }) {
  if (verification.status === 'NOT_RUN') {
    // 이름은 찾았지만 아직 확인 전인 경우와, 바꿀 이름이 없는 경우를 구분한다
    const pending = verification.reason === 'NOT_FINALIZED' || verification.reason === 'SKIPPED_BY_OPTION'
    return <p className="muted">{pending ? '개선안 화면에서 아직 다시 해 보지 않았어요.' : '바꿀 이름이 없어서 다시 해 보지 않았어요.'}</p>
  }
  const pairs = verification.pairs
  const main = pairs.find((pair) => mainGoalKey && pair.goalKey === mainGoalKey) ?? pairs[0]
  const others = pairs.filter((pair) => pair !== main)
  return (
    <div className="imp-verification">
      {verification.status === 'FAILED' ? <p role="status" className="muted">다시 해 보다가 멈췄어요. 끝난 것만 보여 드려요.</p> : null}
      {main ? <Pair pair={main} /> : <p className="muted">기록이 없어요.</p>}
      {others.length ? (
        <Disclosure title="다른 목표도 보기">
          {others.map((pair, index) => (
            <section key={`${pair.goalKey ?? 'goal'}-${index}`} className="imp-other-pair" aria-label={goalName(pair)}>
              <h4>{goalName(pair)}</h4>
              <Pair pair={pair} />
            </section>
          ))}
        </Disclosure>
      ) : null}
    </div>
  )
}

const goalName = (pair: VerificationPair) => pair.name ?? '다른 목표'
