import { Link } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'

interface ComparisonErrorProps {
  error: unknown
  onRetry: () => void
}

/** 비교 조회 실패 안내. 오류 코드별로 한 문장과 다음 할 일 하나만 보인다(docs/contracts/rest-api.md) */
export function ComparisonError({ error, onRetry }: ComparisonErrorProps) {
  const code = isApiError(error) ? error.code : null

  if (code === 'RUN_NOT_FOUND') {
    return (
      <div role="alert" className="error-notice">
        <p>비교할 진단을 찾지 못했어요</p>
        <Link to="/">진단하러 가기</Link>
      </div>
    )
  }
  if (code === 'COMPARISON_NOT_READY') {
    return (
      <div role="status" className="error-notice">
        <p>두 진단이 다 끝나면 볼 수 있어요</p>
        <button type="button" onClick={onRetry}>
          다시 확인
        </button>
      </div>
    )
  }
  if (code === 'COMPARISON_RUN_INVALID') {
    return (
      <div role="alert" className="error-notice">
        <p>한쪽 진단이 제대로 끝나지 않았어요</p>
        <Link to="/">다시 진단하기</Link>
      </div>
    )
  }
  if (code === 'ANALYSIS_ERROR') {
    return (
      <div role="alert" className="error-notice">
        <p>결과를 견주다가 문제가 생겼어요</p>
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    )
  }
  return <ErrorNotice error={error} onRetry={onRetry} />
}
