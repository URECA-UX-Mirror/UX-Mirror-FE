import { useState, type ReactNode } from 'react'
import { isApiError } from '../../api/client.ts'
import type { IssueList, Step } from '../../domain/types.ts'
import { screenshotUrl } from '../../api/runs.ts'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import type { PollingStatus } from '../../shared/polling/usePolling.ts'
import { evidenceLabel, evidenceValue, priorityLabel } from './issueLabels.ts'

interface IssuePanelProps {
  issues: IssueList | null
  runId: string
  steps: Step[] | null
  stepsFailed: boolean
  onRetrySteps: () => void
  pollingStatus: PollingStatus
  error: unknown
  /** 자동 재시도(backoff) 중 */
  retrying: boolean
  onRetry: () => void
}

/** 검토 후보(Issue). 서버 순서를 그대로 쓰고 다시 정렬하지 않는다. 열린 상세는 화면 상태다. */
export function IssuePanel({
  issues,
  runId,
  steps,
  stepsFailed,
  onRetrySteps,
  pollingStatus,
  error,
  retrying,
  onRetry,
}: IssuePanelProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null)

  let body: ReactNode
  if (!issues) {
    body = error && pollingStatus === 'failed' ? (
      <p role="alert">
        검토 후보를 불러오지 못했습니다
        {isApiError(error) ? ` (${error.message})` : ''}.{' '}
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      </p>
    ) : (
      <p role="status">
        {retrying ? '연결 재시도 중' : '검토 후보를 불러오는 중'}
      </p>
    )
  } else if (issues.analysisStatus === 'PENDING') {
    body = (
      <p role="status">
        {pollingStatus === 'failed' && error
          ? `분석 대기 중 (조회 실패${isApiError(error) ? `: ${error.message}` : ''})`
          : retrying
            ? '분석 대기 중 · 연결 재시도 중'
            : '분석 대기 중'}
        {pollingStatus === 'exhausted' || pollingStatus === 'failed' ? (
          <>
            {' '}
            <button type="button" onClick={onRetry}>
              다시 조회
            </button>
          </>
        ) : null}
      </p>
    )
  } else if (issues.analysisStatus === 'FAILED') {
    body = <p role="alert">분석에 실패했습니다</p>
  } else if (issues.items.length === 0) {
    body = <p>검토 후보 0건</p>
  } else {
    body = (
      <ul className="issue-list">
        {issues.items.map((issue) => {
          const open = openId === issue.issueId
          return (
            <li key={issue.issueId}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpenId(open ? null : issue.issueId)
                  setSelectedStepId(open ? null : issue.stepId)
                }}
              >
                <span className="issue-priority">
                  {priorityLabel(issue.reviewPriority)}
                </span>{' '}
                {issue.title}
              </button>
              {open ? (
                <div className="issue-detail">
                  <p>{issue.description}</p>
                  <p>
                    유형: {issue.issueType}
                    {issue.pageKey ? ` · 화면: ${issue.pageKey}` : ''}
                    {issue.stepId === null ? '' : ` · Step ${issue.stepId}`}
                    {` · 발생 ${issue.occurrenceCount}회`}
                  </p>
                  {issue.relatedStepIds.length > 0 ? (
                    <div aria-label="관련 Step">
                      <p>관련 Step</p>
                      {issue.relatedStepIds.map((id) => (
                        <button key={id} type="button" aria-pressed={selectedStepId === id}
                          onClick={() => setSelectedStepId(id)}>Step {id} 보기</button>
                      ))}
                      {selectedStepId !== null ? (
                        <StepEvidence runId={runId} stepId={selectedStepId} steps={steps}
                          failed={stepsFailed} onRetry={onRetrySteps} />
                      ) : null}
                    </div>
                  ) : null}
                  <p>Issue 근거 (일부 값은 최초 관찰 기준)</p>
                  <dl className="summary-grid" aria-label="Issue 근거">
                    {Object.entries(issue.evidence).map(([key, value]) => (
                      <div key={key} className="evidence-row">
                        <dt>{evidenceLabel(key)}</dt>
                        <dd>{evidenceValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className="result-section" aria-label="검토 후보">
      <h2>검토 후보</h2>
      <p className="probability-note">
        AI 탐색 기록 기반의 검토 후보이며 실제 사용자 결함이 아닙니다
      </p>
      {body}
    </section>
  )
}

function StepEvidence({ runId, stepId, steps, failed, onRetry }: {
  runId: string
  stepId: number
  steps: Step[] | null
  failed: boolean
  onRetry: () => void
}) {
  const step = steps?.find((item) => item.stepId === stepId)
  if (!step) {
    const message = failed ? 'Step 정보를 불러오지 못했습니다'
      : steps === null ? 'Step 정보를 불러오는 중' : `Step ${stepId} 정보를 찾을 수 없습니다`
    return <p role="status">{message} {failed ? <button type="button" onClick={onRetry}>다시 시도</button> : null}</p>
  }
  return (
    <div aria-label={`Step ${step.stepId} 근거`}>
      <ScreenshotViewer key={`${runId}:${step.stepId}`} src={screenshotUrl(runId, step.stepId)}
        alt={`Step ${step.stepId} 근거 화면`} viewport={step.page.viewport}
        screenshotSize={step.page.screenshotSize} scroll={step.page.scroll}
        boxes={step.candidates.map((candidate) => ({
          id: candidate.optionId, bbox: candidate.bbox, label: candidate.label,
          probability: candidate.probability, highlighted: candidate.selected,
        }))} runInProgress={false} />
      <CandidateProbabilityList candidates={step.candidates} decision={step.decision} />
    </div>
  )
}
