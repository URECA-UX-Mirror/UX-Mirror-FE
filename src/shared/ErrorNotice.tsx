import { NETWORK_ERROR_MESSAGE, isApiError } from '../api/client.ts'

interface ErrorNoticeProps {
  error: unknown
  /** 있으면 `retryable` 오류에서 재시도 버튼을 보인다 */
  onRetry?: () => void
}

/**
 * 오류 안내. 서버의 `error.message`만 보이고 `details`는 보이지 않는다.
 * `retryable`이면 재시도 버튼을 보이고, 아니면 메시지만 보인다.
 */
export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const message = isApiError(error) ? error.message : NETWORK_ERROR_MESSAGE
  const retryable = isApiError(error) ? error.retryable : true
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
