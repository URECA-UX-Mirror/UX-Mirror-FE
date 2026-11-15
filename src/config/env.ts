// 환경변수는 이 파일에서만 읽는다. 다른 파일은 여기서 내보낸 값을 가져다 쓴다.

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

/** 마지막 `/` 없는 백엔드 주소. API 경로(`/api/...`)를 뒤에 붙여 쓴다. */
export const apiBaseUrl: string = (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, '')

/** true이면 MSW가 API 응답을 대신한다. 값이 정확히 `true`일 때만 켠다. */
export const useMock: boolean = import.meta.env.VITE_USE_MOCK === 'true'
