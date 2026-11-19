import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { getRun, getRunIssues, getRunSteps, listRuns } from '../../api/runs.ts'
import { isScenarioRun, pageLabel } from '../../domain/site.ts'
import { useRunSite } from '../../shared/useRunSite.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { Run } from '../../domain/types.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { formatDateTime } from '../../shared/stepLabel.ts'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
import { VERSIONS } from '../new-analysis/constants.ts'
import { statusLabel } from '../run-progress/statusLabel.ts'
import { IssuePanel } from './IssuePanel.tsx'
import { OtherRuns } from './OtherRuns.tsx'
import { PathPanel } from './PathPanel.tsx'
import { RunSummaryPanel } from './RunSummaryPanel.tsx'

/** 종료 후에도 `PENDING`이면 이슈만 최대 5회 다시 조회한다(`docs/contracts/run-lifecycle.md`). */
const ISSUE_MAX_REFETCHES = 5

/** 화면 ③. `runId`로 새로고침 뒤에도 복원한다. */
export function RunResultPage() {
  const { runId = '' } = useParams()
  const runQuery = usePolling<Run>({
    fetch: (signal) => getRun(runId, signal),
    isDone: () => true,
    resetKey: runId,
  })
  const run = runQuery.data

  if (!run) {
    if (runQuery.status === 'failed' && runQuery.error) {
      if (isApiError(runQuery.error) && runQuery.error.status === 404) {
        return (
          <section>
            <h1>UX 탐색 분석 결과</h1>
            <p role="alert">실행을 찾을 수 없습니다</p>
            <Link to="/">새 분석 시작하기</Link>
          </section>
        )
      }
      return (
        <section>
          <h1>UX 탐색 분석 결과</h1>
          <ErrorNotice error={runQuery.error} onRetry={runQuery.retry} />
        </section>
      )
    }
    return (
      <section>
        <h1>UX 탐색 분석 결과</h1>
        <p role="status">
          {runQuery.error ? '연결 재시도 중' : '결과를 불러오는 중'}
        </p>
      </section>
    )
  }

  if (!isTerminalStatus(run.status)) {
    return (
      <section>
        <h1>UX 탐색 분석 결과</h1>
        <p role="status">
          아직 진행 중인 실행입니다. 결과는 실행이 끝나면 볼 수 있습니다.
        </p>
        <Link to={`/runs/${encodeURIComponent(run.runId)}`}>
          진행 화면으로 이동
        </Link>
      </section>
    )
  }

  // 다른 Run으로 이동하면 선택·펼침 같은 화면 상태를 새로 시작한다.
  return <ResultBody key={run.runId} run={run} />
}

function ResultBody({ run }: { run: Run }) {
  const [selected, setSelected] = useState(0)
  const site = useRunSite(run)
  const scenario = isScenarioRun(run)
  const version = VERSIONS.find((item) => item.variant === run.variant)
  const steps = usePolling({
    fetch: (signal) => getRunSteps(run.runId, signal),
    isDone: () => true,
    resetKey: run.runId,
  })
  const issues = usePolling({
    fetch: (signal) => getRunIssues(run.runId, signal),
    isDone: (data) => data.analysisStatus !== 'PENDING',
    resetKey: run.runId,
    maxRefetches: ISSUE_MAX_REFETCHES,
  })
  const runs = usePolling({
    fetch: (signal) => listRuns({ experimentKey: run.experimentKey }, signal),
    isDone: () => true,
    resetKey: run.experimentKey,
  })

  return (
    <section className="result-page">
      <section className="card run-head" aria-label="실행 정보">
        <div className="run-head-top">
          <div className="page-title-row">
            <h1>UX 탐색 분석 결과</h1>
            <span role="status" className="run-status" data-status={run.status}>
              {statusLabel(run)}
            </span>
            <ResultOriginBadge origin={run.resultOrigin} />
            <ReplayNotice experimentKey={run.experimentKey} origins={[run.resultOrigin]} />
          </div>
          {!scenario ? <Link
            className="run-result-link"
            to={`/comparisons/${encodeURIComponent(run.experimentKey)}`}
          >
            버전 비교 보기
          </Link> : null}
        </div>
        <dl className="meta-row">
          <div>
            <dt>실행 ID</dt>
            <dd>
              <span className="run-id">{run.runId}</span>
            </dd>
          </div>
          <div>
            <dt>버전</dt>
            <dd>{scenario ? `시나리오 테스트 · ${site?.name ?? run.siteId ?? '-'}` : version ? `${version.name} · ${version.change}` : run.variant}</dd>
          </div>
          <div>
            <dt>실행 일시</dt>
            <dd className="num">{formatDateTime(run.startedAt ?? run.createdAt)}</dd>
          </div>
          <div>
            <dt>사용자 유형</dt>
            <dd>{run.persona}</dd>
          </div>
          <div className="meta-goal">
            <dt>탐색 목표</dt>
            <dd>{run.goal}</dd>
          </div>
        </dl>
      </section>

      <RunSummaryPanel run={run} issues={issues.data} siteMapUnavailable={scenario && site?.siteMapAvailable === false} />

      {run.summary ? (
        <PathPanel
          runId={run.runId}
          labelPage={(key) => pageLabel(site, key)}
          basis={run.referenceBasis}
          path={run.summary.path}
          steps={steps.data}
          stepsFailed={steps.status === 'failed'}
          stepsRetrying={steps.retrying}
          onRetrySteps={steps.retry}
          goalReached={run.summary.goalReached}
          selected={selected}
          onSelect={setSelected}
        />
      ) : null}

      <IssuePanel
        runId={run.runId}
        labelPage={(key) => pageLabel(site, key)}
        validity={run.validity}
        steps={steps.data}
        stepsFailed={steps.status === 'failed'}
        onRetrySteps={steps.retry}
        issues={issues.data}
        pollingStatus={issues.status}
        error={issues.error}
        retrying={issues.retrying}
        onRetry={issues.retry}
      />

      <OtherRuns
        currentRunId={run.runId}
        items={runs.data}
        error={runs.error}
        failed={runs.status === 'failed'}
        onRetry={runs.retry}
      />
    </section>
  )
}
