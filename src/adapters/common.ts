import type { ErrorDetailDto } from '../api/dto/common.ts'
import type { ErrorInfo } from '../domain/types.ts'

/** `details`는 화면에 표시하지 않으므로 가져오지 않는다. */
export function toErrorInfo(dto: ErrorDetailDto): ErrorInfo {
  return {
    code: dto.code,
    message: dto.message,
    retryable: dto.retryable,
    occurredAt: dto.occurredAt ?? null,
  }
}

export function toErrorInfoOrNull(
  dto: ErrorDetailDto | null | undefined,
): ErrorInfo | null {
  return dto ? toErrorInfo(dto) : null
}
