import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { ImprovementListItemDto } from '../src/api/improvements.ts'
import { ImprovementListPage } from '../src/features/improvement/ImprovementListPage.tsx'
import { shortTime } from '../src/features/improvement/labels.ts'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// 받은 개선안 (GET /api/improvements, BE #130). 메뉴에는 없고, 새 개선안은 진단 화면에서만 받는다

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/improvements']}>
      <Routes>
        <Route path="/improvements" element={<ImprovementListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function item(over: Partial<ImprovementListItemDto>): ImprovementListItemDto {
  return {
    improvementId: 'imp_1', kind: 'LIVE', status: 'COMPLETED', phase: 'DONE',
    createdAt: '2026-11-19T10:20:00Z', startedAt: null, finishedAt: null, error: null, input: null, summary: null,
    ...over,
  }
}

it('시작 칸 없이 제목과 지난 결과만 있고, 결과가 없으면 새 진단으로 안내한다', async () => {
  renderList()
  expect(screen.getByRole('heading', { level: 1, name: '받은 개선안' })).toBeTruthy()
  const list = screen.getByRole('region', { name: '지난 결과' })
  expect(within(list).getByRole('status').textContent).toBe('불러오는 중이에요')
  expect(await within(list).findByText('아직 받은 개선안이 없어요.')).toBeTruthy()
  expect(within(list).getByRole('link', { name: '새 진단 하러 가기' }).getAttribute('href')).toBe('/')
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('지난 결과를 사람 말 제목·상태·시각으로 보이고 상세로 연결한다', async () => {
  server.use(http.get(apiUrl('/api/improvements'), () => HttpResponse.json({
    items: [
      item({ improvementId: 'imp_A', kind: 'OFFICIAL', summary: { beforeLabel: '이용정보', afterLabel: '주문 환불' } }),
      item({ improvementId: 'imp_B', summary: { beforeLabel: '이용정보', afterLabel: null }, input: { goal: '환불하고 싶어요', persona: '숨은 값', goalPage: 'refund', sourceRunId: 'run_9' } }),
      item({ improvementId: 'imp_C', status: 'RUNNING', createdAt: null, input: { goal: '환불하고 싶어요', persona: '숨은 고객 유형', goalPage: 'refund' } }),
      item({ improvementId: 'imp_D', status: 'FAILED', kind: undefined }),
      item({ improvementId: 'imp_E', status: 'INTERRUPTED' }),
      item({ improvementId: 'imp_F', status: 'WEIRD' }),
    ],
  })))
  renderList()
  const rows = await within(screen.getByRole('region', { name: '지난 결과' })).findAllByRole('listitem')
  // 시각은 브라우저 시간대로 보인다
  const at = shortTime('2026-11-19T10:20:00Z')
  expect(rows.map((li) => li.textContent)).toEqual([
    `'이용정보' → '주문 환불' · ${at}`,
    `환불하고 싶어요 · 환불 신청 · 바꿀 이름 없음 · ${at}`,
    '환불하고 싶어요 · 환불 신청 · 진행 중',
    `개선안 · 끝내지 못함 · ${at}`,
    `개선안 · 중간에 멈춤 · ${at}`,
    `개선안 · 확인 필요 · ${at}`,
  ])
  expect(within(rows[0]).getByRole('link').getAttribute('href')).toBe('/improvements/imp_A')
  // 진단에서 시작한 결과는 그 진단 화면으로 바로 간다
  expect(within(rows[1]).getByRole('link').getAttribute('href')).toBe('/runs/run_9')
  expect(document.body.textContent).not.toMatch(/imp_|OFFICIAL|WEIRD|숨은/)
})

it('목록을 불러오지 못하면 안내한다', async () => {
  server.use(http.get(apiUrl('/api/improvements'), () => errorResponse(500, 'INTERNAL', '서버 오류')))
  renderList()
  expect((await screen.findByRole('alert')).textContent).toBe('지난 결과를 불러오지 못했어요.')
})
