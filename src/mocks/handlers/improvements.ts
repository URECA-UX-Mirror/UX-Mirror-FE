import { http, HttpResponse } from 'msw'
import { apiUrl } from '../../api/client.ts'
import { errorResponse } from '../errors.ts'

// AI 개선 (BE #130). MOCK에서는 목록이 비어 있고, 시작은 실제 서버가 필요하다고 답한다.
export const improvementsHandlers = [
  http.get(apiUrl('/api/improvements'), () => HttpResponse.json({ items: [] })),
  http.get(apiUrl('/api/improvements/:improvementId'), () =>
    errorResponse(404, 'IMPROVEMENT_NOT_FOUND', 'AI 개선 결과를 찾을 수 없습니다.')),
  http.post(apiUrl('/api/improvements'), () =>
    errorResponse(503, 'IMPROVEMENTS_DISABLED', '예시 데이터 모드에서는 AI 개선을 시작할 수 없어요.')),
]
