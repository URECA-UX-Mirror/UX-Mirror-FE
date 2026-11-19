import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { Area } from '../../domain/improvement.ts'
import { useImprovement } from './useImprovement.ts'
import './improvement.css'

/** JSON에 `limitations`가 없거나 비어 있을 때 쓰는 기본 안내 */
const DEFAULT_LIMITATIONS =
  'Zoro-1의 선택 분포에 기반한 추정 결과이며, 실제 사용자 클릭률이나 UX 개선 효과를 입증하지 않습니다. 사람 대상 사용성 테스트를 위한 검토 자료로 활용해 주세요.'

export function ImprovementPage() {
  const { improvementId } = useParams()
  if (!improvementId) return null
  // 주소의 improvementId가 바뀌면 로딩 상태를 새로 시작한다.
  return <ImprovementView key={improvementId} improvementId={improvementId} />
}

function ImprovementView({ improvementId }: { improvementId: string }) {
  const state = useImprovement(improvementId)

  if (state.phase === 'loading') {
    return (
      <section className="improvement-page">
        <h1>자동 개선 리포트</h1>
        <p role="status">자동 개선 결과를 불러오는 중</p>
      </section>
    )
  }
  if (state.phase !== 'success') {
    const message = {
      notFound: '자동 개선 결과를 찾을 수 없음',
      parseError: '자동 개선 결과 파일을 읽을 수 없음(JSON 형식 오류)',
      error: '자동 개선 결과를 불러오지 못했습니다',
    }[state.phase]
    return (
      <section className="improvement-page">
        <h1>자동 개선 리포트</h1>
        <p role="alert" className="error-notice">
          {message}
        </p>
        <Link to="/">새 분석으로 이동</Link>
      </section>
    )
  }

  const { view } = state
  // `report` 영역이 오류여도 헤더 메타(샘플 배지·생성 시각·상태)는 보인다.
  const { sample, status, createdAt } = view.meta

  return (
    <section className="improvement-page">
      <section className="card" aria-label="자동 개선 정보">
        <div className="page-title-row">
          <h1>자동 개선 리포트</h1>
          {/* E(공식 비교) 결과와 구분한다 */}
          <span className="experiment-tag">추가 실험</span>
          {sample ? <span className="sample-badge">샘플 데이터</span> : null}
        </div>
        <dl className="meta-row">
          <div>
            <dt>개선 ID</dt>
            <dd>
              <span className="run-id">{improvementId}</span>
            </dd>
          </div>
          {createdAt ? (
            <div>
              <dt>생성 시각</dt>
              <dd>{createdAt}</dd>
            </div>
          ) : null}
        </dl>
        {status !== null && status !== 'COMPLETED' ? (
          <p role="status" className="improvement-status">
            {statusMessage(status)}
          </p>
        ) : null}
      </section>

      <AreaSlot title="① 개선 효과" area={view.report} />
      <AreaSlot title="② 실제 검증" area={view.verification} />
      <AreaSlot title="보조 정보" area={view.official}>
        {/* 공식 평가·회차 상세는 보조 영역 이슈가 채운다 */}
      </AreaSlot>
      {!view.rounds.ok ? <AreaSlot title="개선 회차" area={view.rounds} /> : null}

      {/* 영역 오류나 `limitations` 누락과 상관없이 항상 보인다 */}
      <p className="improvement-limitations">
        {view.limitations?.trim() || DEFAULT_LIMITATIONS}
      </p>
    </section>
  )
}

/** `COMPLETED`가 아닌 값. 모르는 값은 원문으로 보인다 */
function statusMessage(status: string): string {
  switch (status) {
    case 'RUNNING':
    case 'IN_PROGRESS':
      return `자동 개선이 진행 중입니다(상태: ${status})`
    case 'FAILED':
      return `자동 개선이 실패했습니다(상태: ${status})`
    default:
      return `완료되지 않은 결과입니다(상태: ${status})`
  }
}

interface AreaSlotProps {
  title: string
  area: Area<unknown>
  children?: ReactNode
}

/** 영역 자리. 오류이면 그 영역에만 "데이터 오류"를 보이고, 정상이면 영역 이슈가 채우기 전까지 자리 표시를 둔다 */
function AreaSlot({ title, area, children }: AreaSlotProps) {
  return (
    <section className="card improvement-area" aria-label={title}>
      <h2>{title}</h2>
      {area.ok ? (
        (children ?? <p className="area-placeholder">이 영역은 준비 중입니다</p>)
      ) : (
        <p role="alert" className="error-notice">
          데이터 오류: {area.reason}
        </p>
      )}
    </section>
  )
}
