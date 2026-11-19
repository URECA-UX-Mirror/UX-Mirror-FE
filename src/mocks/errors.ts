import { HttpResponse } from 'msw'
import type { ErrorDetailDto } from '../api/dto/index.ts'

/** 계약 §16.1 형식(`{ error }`)의 오류 응답을 만든다. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false,
) {
  const error: ErrorDetailDto = {
    code,
    message,
    retryable,
    details: null,
    occurredAt: new Date().toISOString(),
  }
  return HttpResponse.json({ error }, { status })
}

export const runNotFound = () =>
  errorResponse(404, 'RUN_NOT_FOUND', '실행을 찾을 수 없습니다')
