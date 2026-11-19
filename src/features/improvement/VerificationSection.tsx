import { Link } from 'react-router'
import type { ImprovementVerification, VerificationPair, VerificationRun } from '../../domain/improvement.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'

// 프로토콜 상대 주소, 역슬래시, 제어 문자는 브라우저가 외부 주소로 해석할 수 있다.
function internalPath(path: string | null): path is string {
  return path !== null && /^\/(?!\/)[^\\\s]*$/.test(path)
}

function canReplay(run: VerificationRun | null): run is VerificationRun {
  return run !== null && run.validity === 'VALID' && run.status !== null && isTerminalStatus(run.status)
}

function outcome(run: VerificationRun): string {
  const steps = run.stepCount === null ? '단계 수 없음' : `${run.stepCount}단계`
  const goal = run.goalReached === null ? '도달 여부 없음' : run.goalReached ? '성공' : '도달 실패'
  return `${steps} ${goal}`
}

function RunDetails({ title, run }: { title: string; run: VerificationRun | null }) {
  if (!run) return <div className="verification-run"><h4>{title}</h4><p>Run 없음</p></div>
  const valid = canReplay(run)
  return (
    <div className="verification-run">
      <h4>{title} · {run.label ?? '라벨 없음'}</h4>
      <p>상태: {run.status ?? '없음'} · 유효성: {run.validity ?? '없음'}</p>
      {run.validity === 'INVALID' ? <p><strong>판단 불가</strong> (경로와 단계는 참고용)</p> : null}
      <p>목표 도달: {run.validity === 'INVALID' ? '판단 불가' : run.goalReached === null ? '정보 없음' : run.goalReached ? '도달' : '미도달'}</p>
      <p>경로: {run.path.length ? run.path.join(' → ') : '정보 없음'}</p>
      <p>단계 수: {run.stepCount === null ? '정보 없음' : `${run.stepCount}단계`}</p>
      <p>Issue: {run.issues.length ? run.issues.join(', ') : '없음'}</p>
      <p>결과 출처: {run.resultOrigin ?? '정보 없음'}</p>
      {valid ? <nav aria-label={`${title} 재생`} className="verification-links">
        {internalPath(run.resultPath) ? <Link to={run.resultPath}>결과 보기</Link> : null}
        {internalPath(run.progressPath) ? <Link to={run.progressPath}>진행 보기</Link> : null}
      </nav> : null}
    </div>
  )
}

function PairCard({ pair }: { pair: VerificationPair }) {
  const comparable = canReplay(pair.before) && canReplay(pair.after)
  const before = pair.before
  const after = pair.after
  const same = comparable && before && after && before.stepCount === after.stepCount && before.goalReached === after.goalReached && before.stepCount !== null && before.goalReached !== null && before.status === after.status &&
    before.path.length === after.path.length && before.path.every((value, index) => value === after.path[index]) &&
    before.issues.length === after.issues.length && before.issues.every((value, index) => value === after.issues[index])
  return (
    <article className="verification-pair">
      <h3>{pair.name ?? '목표 이름 없음'} {pair.goalKey ? `(${pair.goalKey})` : ''}</h3>
      {comparable && before && after ? <p className="verification-summary">{same ? '변화 없음' : `${outcome(before)} → ${outcome(after)}`}</p> : null}
      {comparable && internalPath(pair.comparisonPath) ? <Link to={pair.comparisonPath}>비교 보기</Link> : null}
      <div className="verification-runs">
        <RunDetails title="v1" run={before} />
        <RunDetails title="최종안" run={after} />
      </div>
    </article>
  )
}

export function VerificationSection({ verification }: { verification: ImprovementVerification }) {
  if (verification.status === 'NOT_RUN') return <p>검증 미진행</p>
  return (
    <div className="verification-section">
      {verification.status === 'FAILED' ? <p role="status">검증 실패: {verification.error?.code ?? '코드 없음'} · {verification.error?.message ?? '사유 없음'}</p> : null}
      {verification.status !== 'COMPLETED' && verification.status !== 'FAILED' ? <p>검증 상태: {verification.status}</p> : null}
      <p>실행 서버가 필요합니다. 아래 요약은 저장된 결과입니다.</p>
      {verification.pairs.map((pair, index) => <PairCard key={`${pair.goalKey ?? 'goal'}-${index}`} pair={pair} />)}
    </div>
  )
}
