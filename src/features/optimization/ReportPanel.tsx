import { Link } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { getOptimizationReport } from '../../api/optimizations.ts'
import { optimizationApiErrorMessage } from '../../domain/optimizationErrors.ts'
import type { OptimizerRunOutcome, OptimizationReport } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { optimizerRoleLabel } from '../../shared/optimizerRun.ts'
import { CheckCircleIcon } from '../../shared/icons.tsx'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { statusLabel } from '../run-progress/statusLabel.ts'
import { formatCount, NOT_APPLICABLE } from '../run-result/format.ts'
import {
  finalDecisionLabel,
  verificationReasonLabel,
} from './labels.ts'

const NOT_COMPUTABLE = '계산 불가'

const numberText = (value: number | null) => (value === null ? NOT_COMPUTABLE : String(value))

/** 이동 비용 차이. 부호를 붙이고 `null`은 0이 아니라 계산 불가다 */
function deltaText(value: number | null): string {
  if (value === null) return NOT_COMPUTABLE
  return value > 0 ? `+${value}` : String(value)
}

function secondsText(ms: number | null): string {
  return ms === null ? NOT_COMPUTABLE : `${(ms / 1000).toFixed(1)}초`
}

function goalText(value: boolean | null): string {
  if (value === null) return NOT_COMPUTABLE
  return value ? '도달' : '미도달'
}

const pathText = (path: string[]) => (path.length === 0 ? NOT_APPLICABLE : path.join(' → '))

interface RunRow {
  name: string
  value: (run: OptimizerRunOutcome) => string
}

const RUN_ROWS: RunRow[] = [
  { name: '종료 상태', value: (r) => statusLabel({ status: r.status, error: null }) },
  { name: '목표 화면', value: (r) => goalText(r.goalReached) },
  { name: '단계 수', value: (r) => numberText(r.stepCount) },
  { name: '이동 비용', value: (r) => numberText(r.navigationCost) },
  { name: '되돌아간 횟수', value: (r) => (r.backCount === null ? NOT_COMPUTABLE : formatCount(r.backCount)) },
  { name: '실행 시간', value: (r) => secondsText(r.executionTimeMs) },
  { name: '방문 경로', value: (r) => pathText(r.path) },
]

function RunColumnHead({ title, run }: { title: string; run: OptimizerRunOutcome }) {
  return (
    <th scope="col">
      {title}
      {run.label ? ` · ${run.label}` : ''}
      {run.executionRole ? ` (${optimizerRoleLabel(run.executionRole)})` : ''}
      <br />
      <Link to={`/runs/${encodeURIComponent(run.runId)}/result`}>
        <span className="run-id">{run.runId}</span>
      </Link>
    </th>
  )
}

function Decision({ report }: { report: OptimizationReport }) {
  const decision = report.finalDecision ?? report.verification?.decision ?? null
  const reason = report.verification?.reasonCode ?? null
  const decisionLabel = decision ? finalDecisionLabel(decision) : null
  const reasonLabel = reason ? verificationReasonLabel(reason) : null
  return (
    <dl className="meta-row">
      <div>
        <dt>최종 판단</dt>
        <dd>
          {decision ? (
            <>
              {decisionLabel ? `${decisionLabel} ` : null}
              <code>{decision}</code>
            </>
          ) : (
            '-'
          )}
        </dd>
      </div>
      <div>
        <dt>판단 이유</dt>
        <dd>
          {reason ? (
            <>
              {reasonLabel ? `${reasonLabel} ` : null}
              <code>{reason}</code>
            </>
          ) : (
            '-'
          )}
        </dd>
      </div>
      <div>
        <dt>이동 비용 변화</dt>
        <dd className="num">{deltaText(report.verification?.navigationCostDelta ?? null)}</dd>
      </div>
    </dl>
  )
}

function ReportBody({ report }: { report: OptimizationReport }) {
  const { baseline, candidate } = report.runs
  return (
    <>
      <div className="page-title-row">
        <ResultOriginBadge origin={report.resultOrigin} />
      </div>
      <Decision report={report} />

      <div className="report-table-wrap">
        <table className="report-table">
          <caption>기준과 후보 실행 비교</caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <RunColumnHead title="기준" run={baseline} />
              <RunColumnHead title="검증 후보" run={candidate} />
            </tr>
          </thead>
          <tbody>
            {RUN_ROWS.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{row.value(baseline)}</td>
                <td>{row.value(candidate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="report-limitations" role="note">
        <strong>한계</strong> {report.limitations.note}
        <span className="muted">
          {' '}
          (기준 {report.limitations.baselineRunCount}회 · 후보 {report.limitations.candidateRunCount}회
          {report.limitations.repeated ? ' · 반복 실행' : ' · 반복 없음'})
        </span>
      </p>

      <p>
        <Link to={`/comparisons/${encodeURIComponent(report.optimizationId)}`}>
          버전 비교 화면에서 두 실행 자세히 보기
        </Link>
      </p>

      <details className="report-details">
        <summary>정책·모델·동결 조건</summary>
        <dl className="meta-row">
          <div>
            <dt>선정 정책</dt>
            <dd>{report.policyVersions.selection ?? '-'}</dd>
          </div>
          <div>
            <dt>검증 정책</dt>
            <dd>{report.policyVersions.verification ?? '-'}</dd>
          </div>
          <div>
            <dt>모델 버전</dt>
            <dd>{report.model.modelVersion ?? '-'}</dd>
          </div>
          <div>
            <dt>모델 엔드포인트</dt>
            <dd>{report.model.modelEndpointId ?? '-'}</dd>
          </div>
          <div>
            <dt>프롬프트 버전</dt>
            <dd>{report.model.promptVersion ?? '-'}</dd>
          </div>
          <div>
            <dt>목표</dt>
            <dd>{report.conditions.goal}</dd>
          </div>
          <div>
            <dt>사용자 유형</dt>
            <dd>{report.conditions.persona}</dd>
          </div>
          <div>
            <dt>시작 경로</dt>
            <dd className="mono">{report.conditions.startPath}</dd>
          </div>
          <div>
            <dt>모델 호출 수</dt>
            <dd className="num">{report.executionMetadata.modelCallCount}</dd>
          </div>
          <div>
            <dt>평가 시간</dt>
            <dd className="num">{secondsText(report.executionMetadata.evaluationTimeMs)}</dd>
          </div>
          <div>
            <dt>검증 시간</dt>
            <dd className="num">{secondsText(report.executionMetadata.verificationTimeMs)}</dd>
          </div>
        </dl>
      </details>
    </>
  )
}

/** 완료된(`COMPLETED`) Optimization의 보고서. 한 번만 조회하고 실패하면 다시 시도 버튼으로 다시 조회한다 */
export function ReportPanel({ optimizationId }: { optimizationId: string }) {
  const report = usePolling<OptimizationReport>({
    resetKey: optimizationId,
    fetch: (signal) => getOptimizationReport(optimizationId, signal),
    isDone: () => true,
  })
  return (
    <section className="card" aria-label="검증 보고서">
      <SectionTitle icon={<CheckCircleIcon />} title="검증 보고서" />
      {report.data ? (
        <ReportBody report={report.data} />
      ) : report.status === 'failed' ? (
        isApiError(report.error) ? (
          <div role="alert" className="error-notice">
            <p>{optimizationApiErrorMessage(report.error.code, report.error.message)}</p>
            <button type="button" onClick={report.retry}>
              다시 시도
            </button>
          </div>
        ) : (
          <ErrorNotice error={report.error} onRetry={report.retry} />
        )
      ) : (
        <p role="status">{report.retrying ? '연결 재시도 중' : '보고서를 불러오는 중'}</p>
      )}
    </section>
  )
}
