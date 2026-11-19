import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handlers/index.ts'

// 정적 자동 개선 결과(`/improvements/*.json`)는 테스트가 server.use로 따로 정하지 않으면 없는 파일로 본다(실제 요청 방지)
export const server = setupServer(http.get('/improvements/*', () => new HttpResponse(null, { status: 404 })), ...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { cleanup(); server.resetHandlers() })
afterAll(() => server.close())
