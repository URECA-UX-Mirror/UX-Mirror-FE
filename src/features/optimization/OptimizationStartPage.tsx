import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { createOptimization } from '../../api/optimizations.ts'
import { optimizationApiErrorMessage } from '../../domain/optimizationErrors.ts'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { activeOptimizationLabel } from '../../shared/optimizationStatus.ts'
import { useHealth } from '../../shared/useHealth.ts'
import { CompareIcon } from '../../shared/icons.tsx'
import './optimization.css'

/**
 * Optimizer 시작 화면(`/optimizations`). 후보 풀·목표·모델 조건은 서버가 정하므로 입력 칸은 없다.
 * 진단 Run은 선택이며 `?sourceRunId=`로만 받는다. 엔진이 `READY`이고 진행 중인 Run·Optimization이 없을 때만 시작할 수 있다.
 */
export function OptimizationStartPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sourceRunId = params.get('sourceRunId') || undefined
  const { health, error: healthError, loading, reload } = useHealth()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const active = health?.activeOptimization ?? null
  const blockedReason = (() => {
    if (!health) return healthError ? '엔진 상태를 확인할 수 없어 시작할 수 없습니다.' : null
    if (health.status !== 'READY') return '엔진이 준비 중이라 시작할 수 없습니다.'
    if (health.activeRunId) return '진행 중인 분석이 있어 시작할 수 없습니다.'
    if (active) return '진행 중인 후보 평가가 있어 시작할 수 없습니다.'
    return null
  })()
  const canStart = health !== null && blockedReason === null && !submitting

  const start = () => {
    setSubmitting(true)
    setSubmitError(null)
    createOptimization(sourceRunId)
      .then((created) => {
        navigate(`/optimizations/${encodeURIComponent(created.optimizationId)}`)
      })
      .catch((error: unknown) => {
        setSubmitting(false)
        // 다른 작업이 끝났거나 시작됐을 수 있으므로 엔진 상태를 다시 읽는다
        reload()
        setSubmitError(
          isApiError(error)
            ? optimizationApiErrorMessage(error.code, error.message)
            : '예기치 않은 오류가 발생했습니다',
        )
      })
  }

  return (
    <section className="optimization-page">
      <h1>UX Optimizer</h1>
      <section className="card" aria-label="후보 평가 시작">
        <SectionTitle icon={<CompareIcon />} title="후보 평가" />
        <p>
          상단 메뉴의 라벨 후보를 모델로 평가해 검증할 후보를 고릅니다. 후보 풀과 평가
          조건은 서버 설정을 따릅니다.
        </p>
        {sourceRunId ? (
          <p className="muted">
            진단 Run <span className="run-id">{sourceRunId}</span>을 연결해 시작합니다.
          </p>
        ) : null}
        {loading && !health && !healthError ? (
          <p role="status">엔진 상태 확인 중</p>
        ) : null}
        {blockedReason ? (
          <div role="status" className="error-notice">
            <p>{blockedReason}</p>
            {health?.activeRunId ? (
              <Link to={`/runs/${encodeURIComponent(health.activeRunId)}`}>
                진행 중인 분석 보기
              </Link>
            ) : null}
            {active ? (
              <Link to={`/optimizations/${encodeURIComponent(active.optimizationId)}`}>
                {activeOptimizationLabel(active.status)} · 진행 중인 후보 평가 보기
              </Link>
            ) : null}
            <button type="button" onClick={reload}>
              다시 확인
            </button>
          </div>
        ) : null}
        {submitError ? (
          <div role="alert" className="error-notice">
            <p>{submitError}</p>
          </div>
        ) : null}
        <div className="optimization-actions">
          <button type="button" disabled={!canStart} onClick={start}>
            {submitting ? '시작하는 중' : '후보 평가 시작'}
          </button>
        </div>
      </section>
    </section>
  )
}
