import { Link } from 'react-router'
import type { ImprovementVerification, VerificationPair, VerificationRun } from '../../domain/improvement.ts'
import { issueTypeLabel } from '../../shared/runLabels.ts'
import { screenName } from './labels.ts'
import { canReplay, internalPath } from './verificationLinks.ts'

/** "2번 만에 도착" / "4번 눌렀지만 찾지 못함" */
function outcome(run: VerificationRun): string {
  if (run.validity === 'INVALID') return '결과를 판단할 수 없음'
  const clicks = run.stepCount === null ? '' : `${run.stepCount}번 `
  if (run.goalReached === true) return `${clicks}만에 도착`.trim()
  if (run.goalReached === false) return `${clicks}눌렀지만 찾지 못함`.trim()
  return '결과 정보 없음'
}

function RunLine({ title, run }: { title: string; run: VerificationRun | null }) {
  if (!run) return <div className="verification-run"><h4>{title}</h4><p>실행 기록이 없어요</p></div>
  return (
    <div className="verification-run" data-reached={run.goalReached === true ? 'yes' : 'no'}>
      <h4>{title}{run.label ? ` · "${run.label}"` : ''}</h4>
      <p className="verification-outcome">{outcome(run)}</p>
      {run.path.length ? <p className="muted">{run.path.map(screenName).join(' → ')}</p> : null}
      {run.validity !== 'INVALID' && run.issues.length ? <p className="muted">{run.issues.map(issueTypeLabel).join(' · ')}</p> : null}
      {canReplay(run) && internalPath(run.resultPath) ? <Link to={run.resultPath}>다시 보기</Link> : null}
    </div>
  )
}

function PairCard({ pair }: { pair: VerificationPair }) {
  const comparable = canReplay(pair.before) && canReplay(pair.after)
  return (
    <article className="verification-pair">
      <h3>{pair.name ? `${pair.name}하려는 고객` : '고객'}</h3>
      <div className="verification-runs">
        <RunLine title="지금 화면" run={pair.before} />
        <RunLine title="개선안" run={pair.after} />
      </div>
      {comparable && internalPath(pair.comparisonPath) ? <Link to={pair.comparisonPath} className="primary-link">나란히 비교하기</Link> : null}
    </article>
  )
}

export function VerificationSection({ verification }: { verification: ImprovementVerification }) {
  if (verification.status === 'NOT_RUN') return <p>이번에는 개선안에서 다시 확인하지 않았어요 (채택된 이름이 없을 때 등).</p>
  return (
    <div className="verification-section">
      {verification.status === 'FAILED' ? <p role="status">개선안에서 다시 확인하는 중에 멈췄어요. 끝난 것까지만 보여줘요.</p> : null}
      {verification.pairs.map((pair, index) => <PairCard key={`${pair.goalKey ?? 'goal'}-${index}`} pair={pair} />)}
    </div>
  )
}
