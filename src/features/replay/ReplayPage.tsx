import { Link } from 'react-router'
import { listRuns } from '../../api/runs.ts'
import { VERSIONS } from '../new-analysis/constants.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { HistoryIcon } from '../../shared/icons.tsx'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { shortTime } from '../improvement/labels.ts'
import { statusLabel } from '../run-progress/statusLabel.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { REPLAY_EXPERIMENTS } from './constants.ts'
import { ReplayNotice } from './ReplayNotice.tsx'

/**
 * 저장된 실측 결과 재생(OI-7). 고정 `experimentKey`마다 Run 목록을 조회하기만 하고
 * Run을 만들거나 바꾸는 요청은 보내지 않는다. 각 Run은 기존 진행·결과·비교 화면으로 연결한다.
 * 키마다 목록·오류·비교 가능 여부를 따로 다루므로 한 실험이 실패해도 나머지는 그대로 보인다.
 */
export function ReplayPage() {
  return (
    <section className="replay-page">
      <header className="page-header">
        <div className="page-title-row">
          <h1>저장된 결과 재생</h1>
        </div>
        <p className="page-lead">과거에 실행한 결과를 읽기만 하며 새 실행을 만들지 않습니다.</p>
      </header>
      {REPLAY_EXPERIMENTS.map(({ key, label }) => (
        <ReplayExperiment key={key} experimentKey={key} label={label} />
      ))}
    </section>
  )
}

function ReplayExperiment({ experimentKey, label }: { experimentKey: string; label: string }) {
  const runs = usePolling({
    fetch: (signal) => listRuns({ experimentKey }, signal),
    isDone: () => true,
    resetKey: experimentKey,
  })
  const key = encodeURIComponent(experimentKey)
  // 목록만으로 알 수 있는 최소 조건: 두 버전 모두 종료된 VALID Run이 있어야 비교할 수 있다.
  // Issue 분석 완료 여부는 목록에 없으므로 `COMPARISON_NOT_READY`는 비교 화면의 오류 안내가 맡는다.
  const comparable = VERSIONS.every(({ variant }) =>
    runs.data?.some(
      (run) =>
        run.variant === variant &&
        run.validity === 'VALID' &&
        isTerminalStatus(run.status),
    ),
  )

  return (
    <section className="card" aria-label={`저장된 실행: ${label}`}>
      <SectionTitle icon={<HistoryIcon />} title={label} />
      {runs.data && runs.data.length > 0 ? (
        <ReplayNotice
          experimentKey={experimentKey}
          origins={runs.data.map((run) => run.resultOrigin)}
        />
      ) : null}
      {runs.status === 'failed' ? (
        <ErrorNotice error={runs.error} onRetry={runs.retry} />
      ) : !runs.data ? (
        <p role="status">
          {runs.retrying ? '연결 재시도 중' : '저장된 실행을 불러오는 중'}
        </p>
      ) : runs.data.length === 0 ? (
        <p role="status">저장된 실행이 없습니다</p>
      ) : (
        <>
          <ul className="replay-runs">
            {VERSIONS.map(({ variant, name }) =>
              runs.data!
                .filter((run) => run.variant === variant)
                .map((run) => (
                  <li key={run.runId}>
                    <span className="replay-version">{name}</span>
                    <span className="replay-run">
                      {/* Run ID 대신 버전 이름 + 시작 시각 + 상태로 구분한다 */}
                      <span>
                        {shortTime(run.createdAt) ?? '시각 모름'} · {statusLabel({ status: run.status, error: null })}
                      </span>
                      <ResultOriginBadge origin={run.resultOrigin} />
                    </span>
                    <span className="replay-links">
                      <Link to={`/runs/${encodeURIComponent(run.runId)}`}>진행 보기</Link>
                      <Link to={`/runs/${encodeURIComponent(run.runId)}/result`}>결과 보기</Link>
                    </span>
                  </li>
                )),
            )}
          </ul>
          {comparable ? (
            <p className="card-footer">
              <Link to={`/comparisons/${key}`}>{PAGE_NAMES.comparison} 보기</Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
