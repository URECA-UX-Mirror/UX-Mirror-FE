import { apiBaseUrl } from '../config/env.ts'
import type { ErrorDetailDto } from './dto/index.ts'

export const NETWORK_ERROR_MESSAGE = '서버에 연결할 수 없습니다'

/**
 * API 호출 실패. 서버가 `{ error }` 형식으로 응답하면 그 값을 담고,
 * 그 외(네트워크·프록시 오류, 형식이 다른 응답)는 일반 안내와 재시도 가능으로 만든다.
 * 서버의 `error.details`는 화면에 표시하지 않으므로 담지 않는다.
 */
export class ApiError extends Error {
  /** HTTP 상태 코드. 응답을 받지 못했으면 `null` */
  readonly status: number | null
  /** 서버가 정한 오류 코드. `{ error }` 형식이 아니면 `null` */
  readonly code: string | null
  readonly retryable: boolean

  constructor(init: {
    status: number | null
    code: string | null
    message: string
    retryable: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.retryable = init.retryable
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/** 요청이 `AbortController`로 취소된 경우. 화면 오류로 보이지 않게 호출하는 쪽에서 무시한다. */
export function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === 'AbortError'
}

/** `VITE_API_BASE_URL`에 API 경로를 붙인다. 스크린샷 주소도 이 함수로 만든다. */
export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`
}

function isErrorDetail(value: unknown): value is ErrorDetailDto {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.code === 'string' && typeof candidate.message === 'string'
  )
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const detail = (body as { error: unknown }).error
      if (isErrorDetail(detail)) {
        return new ApiError({
          status: response.status,
          code: detail.code,
          message: detail.message,
          retryable: detail.retryable === true,
        })
      }
    }
  } catch {
    // 본문이 JSON이 아니면 아래 일반 오류로 처리한다.
  }
  return new ApiError({
    status: response.status,
    code: null,
    message: NETWORK_ERROR_MESSAGE,
    retryable: true,
  })
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal } = options

  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal,
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError({
      status: null,
      code: null,
      message: NETWORK_ERROR_MESSAGE,
      retryable: true,
    })
  }

  if (!response.ok) throw await toApiError(response)

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError({
      status: response.status,
      code: null,
      message: NETWORK_ERROR_MESSAGE,
      retryable: true,
    })
  }
}
