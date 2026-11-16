import { useEffect } from 'react'
import { isApiError } from '../api/client.ts'

const UNEXPECTED_ERROR_MESSAGE = '예기치 않은 오류가 발생했습니다'

interface ErrorNoticeProps {
  error: unknown
  /** 있으면 `retryable` 오류에서 재시도 버튼을 보인다 */
  onRetry?: () => void
}

/**
 * 오류 안내. 서버의 `error.message`만 보이고 `details`는 보이지 않는다.
 * `retryable`이면 재시도 버튼을 보이고, 아니면 메시지만 보인다.
 * `ApiError`가 아닌 예외는 "예기치 않은 오류"로 구분해 보이고 원본은 콘솔에 남긴다
 * (네트워크 오류는 `client.ts`가 이미 `ApiError`로 바꾼다).
 */
export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const known = isApiError(error)
  // API 오류가 아닌 예외(응답 형태가 달라 Adapter에서 난 TypeError 등)는 원인을 찾을 수 있게 콘솔에 남긴다.
  useEffect(() => {
    if (!known) console.error(error)
  }, [known, error])
  const message = known ? error.message : UNEXPECTED_ERROR_MESSAGE
  const retryable = known ? error.retryable : true
  return (
    <div role="alert" className="error-notice">
      <p>{message}</p>
      {retryable && onRetry ? (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  )
}
