import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { ImprovementListItemDto } from '../src/api/improvements.ts'
import { ImprovementListPage } from '../src/features/improvement/ImprovementListPage.tsx'
import { shortTime } from '../src/features/improvement/labels.ts'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// AI 개선 시작(직접 입력)과 지난 결과 목록 (GET·POST /api/improvements, BE #130)

function Detail() {
  return <p>상세 {useParams().improvementId}</p>
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/improvements']}>
      <Routes>
        <Route path="/improvements" element={<ImprovementListPage />} />
        <Route path="/improvements/:improvementId" element={<Detail />} />
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

const startButton = () => screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' })
const goalInput = () => screen.getByLabelText(/고객이 하려는 일/) as HTMLInputElement

it('지난 결과가 없으면(기본 목록) 아직 없다고 안내한다', async () => {
  renderList()
  const list = screen.getByRole('region', { name: '지난 결과' })
  expect(within(list).getByRole('status').textContent).toBe('불러오는 중이에요')
  expect(await within(list).findByText('아직 없어요.')).toBeTruthy()
})

it('지난 결과를 사람 말 제목·상태·종류·시각으로 보이고 상세로 연결한다', async () => {
  server.use(http.get(apiUrl('/api/improvements'), () => HttpResponse.json({
    items: [
      item({ improvementId: 'imp_A', kind: 'OFFICIAL', summary: { beforeLabel: '이용정보', afterLabel: '주문 환불' } }),
      item({ improvementId: 'imp_B', summary: { beforeLabel: '이용정보', afterLabel: null } }),
      item({ improvementId: 'imp_C', status: 'RUNNING', createdAt: null, input: { goal: '환불하고 싶을', persona: '바쁜 고객', goalPage: 'refund' } }),
      item({ improvementId: 'imp_D', status: 'FAILED', kind: undefined }),
      item({ improvementId: 'imp_E', status: 'INTERRUPTED' }),
      item({ improvementId: 'imp_F', status: 'WEIRD' }),
    ],
  })))
  renderList()
  const list = screen.getByRole('region', { name: '지난 결과' })
  const rows = await within(list).findAllByRole('listitem')
  // 시각은 브라우저 시간대로 보인다
  const at = shortTime('2026-11-19T10:20:00Z')
  expect(rows.map((li) => li.textContent)).toEqual([
    `"이용정보" → "주문 환불" · 새 이름 찾음 · 사전 등록 공식 결과 · ${at}`,
    `"이용정보" 그대로 · 바꿀 이름 없음 · 심사위원 실행 (공식 기록 아님) · ${at}`,
    '바쁜 고객 · 환불 신청 · 진행 중 · 심사위원 실행 (공식 기록 아님)',
    `AI 개선 · 끝내지 못함 · ${at}`,
    `AI 개선 · 중간에 멈춤 · 심사위원 실행 (공식 기록 아님) · ${at}`,
    `AI 개선 · 확인 필요 · 심사위원 실행 (공식 기록 아님) · ${at}`,
  ])
  expect(within(rows[0]).getByRole('link').getAttribute('href')).toBe('/improvements/imp_A')
})

it('목록을 불러오지 못하면 안내한다', async () => {
  server.use(http.get(apiUrl('/api/improvements'), () => errorResponse(500, 'INTERNAL', '서버 오류')))
  renderList()
  expect((await screen.findByRole('alert')).textContent).toBe('지난 결과를 불러오지 못했어요.')
})

it('할 일을 적지 않고 시작하면 칸 안내만 보이고 요청하지 않는다', async () => {
  let posted = false
  server.use(http.post(apiUrl('/api/improvements'), () => { posted = true; return HttpResponse.json({}) }))
  renderList()
  fireEvent.click(startButton())
  expect((await screen.findByRole('alert')).textContent).toBe('고객이 하려는 일을(를) 적어 주세요.')
  expect(posted).toBe(false)
})

it('입력이 맞으면 다듬은 값으로 시작하고 상세 화면으로 이동한다', async () => {
  let body: unknown = null
  server.use(http.post(apiUrl('/api/improvements'), async ({ request }) => {
    body = await request.json()
    return HttpResponse.json({
      improvementId: 'imp_new', status: 'QUEUED', phase: 'QUEUED', createdAt: null, startedAt: null,
      finishedAt: null, error: null, improvement: null,
    }, { status: 202 })
  }))
  renderList()
  fireEvent.change(goalInput(), { target: { value: '  지난주에 산 운동화를 돌려보내고 싶을  ' } })
  fireEvent.change(screen.getByLabelText('도착하면 성공인 화면'), { target: { value: 'orders' } })
  fireEvent.click(startButton())
  expect(await screen.findByText('상세 imp_new')).toBeTruthy()
  expect(body).toEqual({ goal: '지난주에 산 운동화를 돌려보내고 싶을', persona: '온라인 쇼핑이 낯선 고객', goalPage: 'orders' })
})

it.each([
  ['이미 진행 중(409)', () => errorResponse(409, 'RUN_ALREADY_ACTIVE', 'run already active'), '지금 다른 진단이나 AI 개선이 진행 중이에요. 끝나면 시작할 수 있어요.'],
  ['예시 데이터 모드(기본 503)', null, '예시 데이터 모드에서는 AI 개선을 시작할 수 없어요.'],
  ['네트워크 오류', () => HttpResponse.error(), '서버에 연결할 수 없습니다'],
])('시작에 실패하면(%s) 안내하고 다시 누를 수 있다', async (_name, respond, text) => {
  if (respond) server.use(http.post(apiUrl('/api/improvements'), respond))
  renderList()
  fireEvent.change(goalInput(), { target: { value: '지난주에 산 운동화를 돌려보내고 싶을' } })
  fireEvent.click(startButton())
  expect((await screen.findByRole('alert')).textContent).toBe(text)
  await waitFor(() => expect((startButton() as HTMLButtonElement).disabled).toBe(false))
})
