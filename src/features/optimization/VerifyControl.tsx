import { useState } from 'react'
import { isApiError } from '../../api/client.ts'
import { startVerification } from '../../api/optimizations.ts'
import { optimizationApiErrorMessage } from '../../domain/optimizationErrors.ts'

interface VerifyControlProps {
  optimizationId: string
  /** 검증할 후보 이름(`주문·환불`). 후보가 없으면 `null`이라 시작할 수 없다 */
  candidateName: string | null
  /** 시작 요청이 끝난 뒤(성공·실패 모두) 상태를 다시 읽게 한다 */
  onSettled: () => void
}

/**
 * "검증 시작". 한 번만 시작할 수 있고(이미 시작했으면 `409 OPTIMIZATION_ALREADY_PROCESSED`) 기준(C0)과 검증 후보 사이트를 차례로 실행한다.
 * 요청 중에는 버튼을 막아 같은 요청을 두 번 보내지 않는다. 성공해도 실행 정보는 응답에 없으므로 다음 조회(폴링)가 보여 준다.
 */
export function VerifyControl({ optimizationId, candidateName, onSettled }: VerifyControlProps) {
  const [submitting, setSubmitting] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setSubmitting(true)
    setError(null)
    startVerification(optimizationId)
      .then(() => setStarted(true))
      .catch((caught: unknown) => {
        setError(
          isApiError(caught)
            ? optimizationApiErrorMessage(caught.code, caught.message)
            : '예기치 않은 오류가 발생했습니다',
        )
      })
      .finally(() => {
        setSubmitting(false)
        onSettled()
      })
  }

  return (
    <div className="verify-control">
      {candidateName === null ? (
        <p className="muted">검증할 후보가 없어 검증을 시작할 수 없습니다.</p>
      ) : (
        <>
          <p className="muted">
            지금 메뉴 이름(기준) 화면과 검증 후보 "{candidateName}" 화면을 실제 브라우저로 한 번씩 실행합니다. 검증은 한 번만 시작할 수 있습니다.
          </p>
          <button type="button" disabled={submitting || started} onClick={start}>
            {submitting ? '검증 시작 중' : started ? '검증을 시작했습니다' : '검증 시작'}
          </button>
        </>
      )}
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
    </div>
  )
}
