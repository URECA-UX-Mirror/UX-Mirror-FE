import { Link } from 'react-router'
import { listRuns } from '../../api/runs.ts'
import { VERSIONS } from '../new-analysis/constants.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { REPLAY_EXPERIMENT_KEY, REPLAY_LABEL } from './constants.ts'

/**
 * 저장된 실측 결과 재생(OI-7). 고정 `experimentKey`의 Run 목록을 조회하기만 하고
 * Run을 만들거나 바꾸는 요청은 보내지 않는다. 각 Run은 기존 진행·결과·비교 화면으로 연결한다.
 */
export function ReplayPage() {
  const runs = usePolling({
    fetch: (signal) => listRuns({ experimentKey: REPLAY_EXPERIMENT_KEY }, signal),
    isDone: () => true,
    resetKey: REPLAY_EXPERIMENT_KEY,
  })
  const key = encodeURIComponent(REPLAY_EXPERIMENT_KEY)

  return (
    <section className="replay-page">
      <h1>{REPLAY_LABEL}</h1>
      <p className="replay-notice" role="note">
        {REPLAY_LABEL} · 과거에 실행한 결과를 읽기만 하며 새 실행을 만들지 않습니다.
      </p>
      <p className="muted">experimentKey: {REPLAY_EXPERIMENT_KEY}</p>

      {runs.status === 'failed' ? (
        <ErrorNotice error={runs.error} onRetry={runs.retry} />
      ) : !runs.data ? (
        <p role="status">
          {runs.retrying ? '연결 재시도 중' : '저장된 실행을 불러오는 중'}
        </p>
      ) : runs.data.length === 0 ? (
        <p role="status">저장된 실행이 없습니다</p>
      ) : (
        <ul className="replay-runs">
          {VERSIONS.map(({ variant, name }) =>
            runs.data!
              .filter((run) => run.variant === variant)
              .map((run) => (
                <li key={run.runId}>
                  {name} · <span className="run-id">{run.runId}</span>{' '}
                  <ResultOriginBadge origin={run.resultOrigin} />{' '}
                  <Link to={`/runs/${encodeURIComponent(run.runId)}`}>진행 보기</Link>{' '}
                  <Link to={`/runs/${encodeURIComponent(run.runId)}/result`}>결과 보기</Link>
                </li>
              )),
          )}
        </ul>
      )}

      {runs.data && runs.data.length > 0 ? (
        <Link to={`/comparisons/${key}`}>버전 비교 보기</Link>
      ) : null}
    </section>
  )
}
