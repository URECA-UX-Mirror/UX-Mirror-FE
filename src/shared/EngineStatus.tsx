import { Link } from 'react-router'
import { useHealth } from './useHealth.ts'

/**
 * 공통 영역의 엔진 상태 표시(`GET /api/health`).
 * "엔진 준비 완료"까지만 말하고 분석 성공을 보장하는 표현은 쓰지 않는다(계약 §17.8).
 * 조회에 실패하면 "확인 불가"로 표시하고 나머지 화면은 계속 쓸 수 있다.
 */
export function EngineStatus() {
  const { health, error, loading } = useHealth()

  if (loading) return <span className="engine-status">엔진 상태 확인 중</span>
  if (error || !health) {
    return <span className="engine-status">엔진 상태 확인 불가</span>
  }

  const ready = health.backendReady && health.modelReady && health.browserReady
  return (
    <span className="engine-status">
      {ready ? '엔진 준비 완료' : '엔진 준비 중'}
      {health.activeRunId ? (
        <>
          {' · '}
          <Link to={`/runs/${encodeURIComponent(health.activeRunId)}`}>
            실행 중인 분석 보기
          </Link>
        </>
      ) : null}
    </span>
  )
}
