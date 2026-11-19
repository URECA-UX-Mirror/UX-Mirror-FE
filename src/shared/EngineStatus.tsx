import { Link } from 'react-router'
import { useHealth } from './useHealth.ts'

interface EngineStatusProps {
  /** 값이 바뀌면 상태를 다시 조회한다. 라우트 이동 때마다 최신 상태를 보이려고 쓴다 */
  refreshKey?: string
}

/**
 * 메뉴 아래의 상태 표시(`GET /api/health`). 점 + 짧은 말 한 줄, 진행 중인 작업은 그 아래 "보기" 링크.
 * 진행 중인 동안만 다시 조회하므로 끝나면 바로 "준비됨"으로 바뀐다.
 */
export function EngineStatus({ refreshKey }: EngineStatusProps) {
  const { health, error, loading } = useHealth(refreshKey)

  if (loading && !health && !error) return <Status state="pending" label="상태 확인 중" />
  if (error || !health) return <Status state="unknown" label="서버에 연결할 수 없어요" />

  const owner = health.activeOwner
  if (owner?.improvementId) {
    return <Status state="busy" label="AI 개선 중" to={`/improvements/${encodeURIComponent(owner.improvementId)}`} />
  }
  if (health.activeRunId) return <Status state="busy" label="진단 중" to={`/runs/${encodeURIComponent(health.activeRunId)}`} />
  if (health.activeOptimization) {
    return <Status state="busy" label="후보 비교 중" to={`/optimizations/${encodeURIComponent(health.activeOptimization.optimizationId)}`} />
  }
  if (owner) return <Status state="busy" label="다른 작업 진행 중" />
  return health.status === 'READY' ? <Status state="ready" label="준비됨" /> : <Status state="pending" label="준비 중" />
}

function Status({ state, label, to }: { state: 'ready' | 'pending' | 'busy' | 'unknown'; label: string; to?: string }) {
  return (
    <div className="engine-status-box">
      <span className="engine-status" data-state={state}>{label}</span>
      {to ? <Link to={to} className="engine-status-link">보기</Link> : null}
    </div>
  )
}
