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
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { statusLabel } from '../run-progress/statusLabel.ts'
import { formatCount, NOT_APPLICABLE } from '../run-result/format.ts'
import { screenName } from '../improvement/labels.ts'
import {
  finalDecisionLabel,
  verificationReasonLabel,
} from './labels.ts'

const NOT_COMPUTABLE = '계산 불가'

const numberText = (value: number | null) => (value === null ? NOT_COMPUTABLE : String(value))

/**
 * 이동 비용 차이. 부호를 붙이고 `null`은 0이 아니다. 서버는 판단 이유가 `NAVIGATION_COST`(두 Run 모두 목표 도달)일 때만 값을 채우므로,
 * 다른 이유로 판단했다면 `null`은 계산 실패가 아니라 이 판단에서 쓰지 않는 값이다.
 */
function deltaText(value: number | null, reasonCode: string | null): string {
  if (value === null) {
    return reasonCode !== null && reasonCode !== 'NAVIGATION_COST'
      ? '해당 없음 (이 판단 이유에서는 이동 비용 변화를 쓰지 않음)'
      : NOT_COMPUTABLE
  }
  return value > 0 ? `+${value}` : String(value)
}

function secondsText(ms: number | null): string {
  return ms === null ? NOT_COMPUTABLE : `${(ms / 1000).toFixed(1)}초`
}

function goalText(value: boolean | null): string {
  if (value === null) return NOT_COMPUTABLE
  return value ? '도달' : '미도달'
}

/** 방문 경로(pageKey 목록)를 화면 이름으로. 모르는 화면은 "다른 화면" */
const pathText = (path: string[]) => (path.length === 0 ? NOT_APPLICABLE : path.map(screenName).join(' → '))

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
      {run.label ? ` · "${run.label}"` : ''}
      {run.executionRole ? ` (${optimizerRoleLabel(run.executionRole)})` : ''}
      <br />
      <Link to={`/runs/${encodeURIComponent(run.runId)}/result`}>결과 보기</Link>
    </th>
  )
}

function Decision({ report }: { report: OptimizationReport }) {
  const decision = report.finalDecision ?? report.verification?.decision ?? null
  const reason = report.verification?.reasonCode ?? null
  return (
    <dl className="meta-row">
      <div>
        <dt>최종 판단</dt>
        <dd>{decision ? finalDecisionLabel(decision) : '-'}</dd>
      </div>
      <div>
        <dt>판단 이유</dt>
        <dd>{reason ? verificationReasonLabel(reason) : '-'}</dd>
      </div>
      <div>
        <dt>이동 비용 변화</dt>
        <dd className="num">{deltaText(report.verification?.navigationCostDelta ?? null, reason)}</dd>
      </div>
    </dl>
  )
}

/**
 * 한계 문구. 서버 `limitations.note`에는 판단 코드(예: 개선 관찰 코드)가 섞여 있어 그대로 보이지 않고,
 * 실행 횟수·반복 여부로 같은 뜻의 문구를 만든다.
 */
function limitationText(report: OptimizationReport): string {
  const { baselineRunCount, candidateRunCount, repeated } = report.limitations
  const counts = `기준 ${baselineRunCount}회 · 후보 ${candidateRunCount}회 실행한 결과입니다.`
  const variance = repeated
    ? ' 반복 실행했지만 결과가 늘 같다고 보장하지는 않습니다.'
    : ' 반복 실행하지 않아 실행마다 결과가 달라질 수 있는지는 확인하지 않았습니다.'
  return `${counts}${variance} 미리 정한 개선 조건이 관찰됐다는 뜻이며, 실제 사용자 경험이 좋아졌다는 증명은 아닙니다.`
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
        <strong>한계</strong> {limitationText(report)}
      </p>

      <p>
        <Link to={`/comparisons/${encodeURIComponent(report.optimizationId)}`}>
          {PAGE_NAMES.comparison} 화면에서 두 실행 자세히 보기
        </Link>
      </p>

      <details className="report-details">
        <summary>비교 조건</summary>
        <dl className="meta-row">
          <div>
            <dt>목표</dt>
            <dd>{report.conditions.goal}</dd>
          </div>
          <div>
            <dt>사용자 유형</dt>
            <dd>{report.conditions.persona}</dd>
          </div>
          <div>
            <dt>AI 호출 수</dt>
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
