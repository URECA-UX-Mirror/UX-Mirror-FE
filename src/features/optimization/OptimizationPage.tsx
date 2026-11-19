import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { optimizationFailureMessage } from '../../domain/optimizationErrors.ts'
import type { Optimization } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { CompareIcon } from '../../shared/icons.tsx'
import { useOptimizationProgress } from '../../shared/useOptimizationProgress.ts'
import { CandidateCard, type CardPhase } from './CandidateCard.tsx'
import { optimizationStatusLabel, phaseLabel } from './labels.ts'
import { ReportPanel } from './ReportPanel.tsx'
import { SelectionPanel } from './SelectionPanel.tsx'
import { VerificationPanel } from './VerificationPanel.tsx'
import { verificationStepLabel } from './verification.ts'
import './optimization.css'

export function OptimizationPage() {
  const { optimizationId } = useParams()
  if (!optimizationId) return null
  // 주소의 optimizationId가 바뀌면 폴링과 화면 상태를 새로 시작한다.
  return <OptimizationView key={optimizationId} optimizationId={optimizationId} />
}

function OptimizationView({ optimizationId }: { optimizationId: string }) {
  const polling = useOptimizationProgress(optimizationId)
  const optimization = polling.data

  if (!optimization) {
    if (polling.status === 'failed') {
      if (isApiError(polling.error) && polling.error.status === 404) {
        return (
          <section>
            <h1>{PAGE_NAMES.optimizerDetail}</h1>
            <p role="alert">후보 평가를 찾을 수 없음</p>
            <Link to="/optimizations">후보 평가 시작</Link>
          </section>
        )
      }
      return (
        <section>
          <h1>{PAGE_NAMES.optimizerDetail}</h1>
          <ErrorNotice error={polling.error} onRetry={polling.retry} />
        </section>
      )
    }
    return (
      <section>
        <h1>{PAGE_NAMES.optimizerDetail}</h1>
        <p role="status">
          {polling.retrying ? '연결 재시도 중' : '후보 평가 정보를 불러오는 중'}
        </p>
      </section>
    )
  }

  return (
    <section className="optimization-page">
      <section className="card" aria-label="후보 평가 정보">
        <div className="page-title-row">
          <h1>{PAGE_NAMES.optimizerDetail}</h1>
          <span role="status" className="run-status" data-status={optimization.status}>
            {optimizationStatusLabel(optimization.status)}
            {verificationStepLabel(optimization) ? ` · ${verificationStepLabel(optimization)}` : ''}
          </span>
          <ResultOriginBadge origin={optimization.resultOrigin} />
        </div>
        <dl className="meta-row">
          <div>
            <dt>대상 메뉴</dt>
            <dd>{optimization.target.originalLabel}</dd>
          </div>
          <div>
            <dt>평가 진행</dt>
            <dd className="num">
              {optimization.progress.evaluatedCount} / {optimization.progress.totalCount}개
            </dd>
          </div>
          {optimization.sourceRunId ? (
            <div>
              <dt>연결한 진단</dt>
              <dd>
                <Link to={`/runs/${encodeURIComponent(optimization.sourceRunId)}/result`}>
                  진단 결과 보기
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
        {polling.status === 'failed' ? (
          <ErrorNotice error={polling.error} onRetry={polling.retry} />
        ) : polling.retrying ? (
          <p role="status">연결 재시도 중</p>
        ) : null}
        <FailureNotice optimization={optimization} />
      </section>

      <Candidates optimization={optimization} />
      <SelectionPanel optimization={optimization} onVerifySettled={polling.retry} />
      <VerificationPanel optimization={optimization} />
      {optimization.status === 'COMPLETED' ? (
        <ReportPanel optimizationId={optimization.optimizationId} />
      ) : null}
    </section>
  )
}

/** 상태가 `FAILED`일 때 실패 원인·단계·직전 상태를 문구로 보인다(오류 코드는 보이지 않는다). `OPTIMIZATION_INTERRUPTED`는 다시 시작하도록 안내한다 */
function FailureNotice({ optimization }: { optimization: Optimization }) {
  const error = optimization.error
  if (optimization.status !== 'FAILED' || !error) return null
  return (
    <div role="alert" className="error-notice">
      <p>{optimizationFailureMessage(error.code, error.message)}</p>
      {error.failedPhase || error.lastStatus ? (
        <p className="muted">
          {[
            error.failedPhase ? `실패 단계 ${phaseLabel(error.failedPhase)}` : null,
            error.lastStatus ? `직전 상태 ${optimizationStatusLabel(error.lastStatus)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      {error.code === 'OPTIMIZATION_INTERRUPTED' ? (
        <p>
          <Link to="/optimizations">후보 평가를 다시 시작해 주세요.</Link>
        </p>
      ) : null}
    </div>
  )
}

function Candidates({ optimization }: { optimization: Optimization }) {
  const ordered = [...optimization.candidates].sort(
    (a, b) => a.candidateOrder - b.candidateOrder,
  )
  const byId = new Map(optimization.evaluations.map((e) => [e.candidateId, e]))
  const firstPending = ordered.find((c) => !byId.has(c.candidateId))?.candidateId
  const phaseOf = (candidateId: string): CardPhase => {
    if (optimization.status === 'FAILED') return 'skipped-by-stop'
    if (optimization.status === 'EVALUATING' && candidateId === firstPending) {
      return 'evaluating'
    }
    return 'waiting'
  }
  const { recommendedCandidateId, verificationCandidateId } = optimization
  return (
    <section className="card" aria-label="후보 목록">
      <SectionTitle icon={<CompareIcon />} title="후보 평가" />
      <p className="muted">모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다</p>
      {ordered.length === 0 ? (
        <p role="status">
          {optimization.status === 'FAILED' ? '후보 목록 없음' : '후보 목록을 불러오는 중'}
        </p>
      ) : (
        <ol className="candidate-list">
          {ordered.map((candidate) => (
            <CandidateCard
              key={candidate.candidateId}
              candidate={candidate}
              evaluation={byId.get(candidate.candidateId)}
              pending={phaseOf(candidate.candidateId)}
              recommended={candidate.candidateId === recommendedCandidateId}
              verification={candidate.candidateId === verificationCandidateId}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
