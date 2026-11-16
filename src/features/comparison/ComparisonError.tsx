import { Link } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'

interface ComparisonErrorProps {
  experimentKey: string
  error: unknown
  onRetry: () => void
}

/** 비교 조회 실패 안내. 오류 코드별로 문구를 구분한다(docs/contracts/rest-api.md). */
export function ComparisonError({ experimentKey, error, onRetry }: ComparisonErrorProps) {
  const code = isApiError(error) ? error.code : null

  if (code === 'RUN_NOT_FOUND') {
    return (
      <div role="alert" className="error-notice">
        <p>비교 대상을 찾을 수 없습니다</p>
        <p className="muted">주소의 실험 키가 올바른지 확인하세요.</p>
        <Link to="/">새 UX 분석으로 이동</Link>
      </div>
    )
  }
  if (code === 'COMPARISON_NOT_READY') {
    return (
      <div role="status" className="error-notice">
        <p>두 버전의 분석이 모두 끝나면 비교할 수 있습니다</p>
        <p className="muted">잠시 뒤 다시 확인하세요.</p>
        <button type="button" onClick={onRetry}>
          다시 확인
        </button>
      </div>
    )
  }
  if (code === 'COMPARISON_RUN_INVALID') {
    return (
      <div role="alert" className="error-notice">
        <p>유효한 실행이 없는 버전이 있습니다</p>
        <Link to={`/?experimentKey=${encodeURIComponent(experimentKey)}`}>
          해당 버전 다시 분석
        </Link>
      </div>
    )
  }
  if (code === 'ANALYSIS_ERROR') {
    return (
      <div role="alert" className="error-notice">
        <p>비교 분석 중 오류가 발생했습니다</p>
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    )
  }
  return <ErrorNotice error={error} onRetry={onRetry} />
}
