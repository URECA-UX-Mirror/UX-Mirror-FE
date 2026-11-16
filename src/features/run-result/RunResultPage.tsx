import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { getRun, getRunIssues, getRunSteps, listRuns } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { Run } from '../../domain/types.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
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
      <header className="result-header">
        <h1>UX 탐색 분석 결과</h1>
        <div>
          <span>{run.runId}</span> <ResultOriginBadge origin={run.resultOrigin} />
        </div>
        <ReplayNotice experimentKey={run.experimentKey} origins={[run.resultOrigin]} />
        <p>
          {run.goal} · {run.persona}
        </p>
      </header>

      <RunSummaryPanel run={run} issues={issues.data} />

      {run.summary ? (
        <PathPanel
          runId={run.runId}
          path={run.summary.path}
          steps={steps.data}
          stepsFailed={steps.status === 'failed'}
          stepsRetrying={steps.retrying}
          onRetrySteps={steps.retry}
          selected={selected}
          onSelect={setSelected}
        />
      ) : null}

      <IssuePanel
        runId={run.runId}
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
