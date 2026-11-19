import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { server } from './setup.ts'

// 자동 개선 리포트 라우트·로더·상태 처리 (FE #78)

const improvedText = () =>
  readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.improved.json'), 'utf-8')
const improved = () => JSON.parse(improvedText())

const json = (body: unknown) => HttpResponse.json(body as Record<string, unknown>)

function serve(id: string, body: unknown) {
  server.use(http.get(`/improvements/${id}.json`, () => json(body)))
}

function renderPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/improvements/${id}`]}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
        <Route path="/" element={<p>새 분석</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

it('결과를 읽으면 헤더·추가 실험·limitations를 보인다', async () => {
  serve('imp_IMPROVED_FIXTURE', improved())
  renderPage('imp_IMPROVED_FIXTURE')
  expect(screen.getByRole('status').textContent).toContain('불러오는 중')
  expect(await screen.findByRole('heading', { name: '자동 개선 리포트' })).toBeTruthy()
  expect(screen.getByText('imp_IMPROVED_FIXTURE')).toBeTruthy()
  expect(screen.getByText('추가 실험')).toBeTruthy()
  expect(screen.getByText(improved().limitations)).toBeTruthy()
  expect(screen.getByRole('region', { name: '① 개선 효과' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '② 실제 브라우저 검증' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('파일이 없으면(404) 찾을 수 없음을 안내한다', async () => {
  server.use(http.get('/improvements/imp_NONE.json', () => new HttpResponse(null, { status: 404 })))
  renderPage('imp_NONE')
  expect((await screen.findByRole('alert')).textContent).toContain('찾을 수 없음')
})

it('index.html(비 JSON)이 돌아오면 파일 없음으로 안내한다', async () => {
  server.use(
    http.get('/improvements/imp_SPA.json', () =>
      HttpResponse.html('<!doctype html><html></html>'),
    ),
  )
  renderPage('imp_SPA')
  expect((await screen.findByRole('alert')).textContent).toContain('찾을 수 없음')
})

it('깨진 JSON이면 파싱 오류를 안내한다', async () => {
  server.use(
    http.get('/improvements/imp_BAD.json', () =>
      new HttpResponse('{"schemaVersion":', { headers: { 'content-type': 'application/json' } }),
    ),
  )
  renderPage('imp_BAD')
  expect((await screen.findByRole('alert')).textContent).toContain('JSON')
})

it('허용되지 않는 id 문자는 요청하지 않고 찾을 수 없음으로 안내한다', async () => {
  let requested = false
  server.use(
    http.get('/improvements/*', () => {
      requested = true
      return json(improved())
    }),
  )
  renderPage('a.b')
  expect((await screen.findByRole('alert')).textContent).toContain('찾을 수 없음')
  expect(requested).toBe(false)
})

it('한 영역이 오류여도 나머지 영역과 limitations는 정상이다', async () => {
  const broken = improved()
  delete broken.verification.status
  serve('imp_PART', broken)
  renderPage('imp_PART')
  await screen.findByText('imp_PART')
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
  const verification = screen.getByRole('region', { name: '② 실제 브라우저 검증' })
  expect(verification.textContent).toContain('데이터 오류')
  expect(screen.getByRole('region', { name: '① 개선 효과' }).textContent).not.toContain('데이터 오류')
  expect(screen.getByText(improved().limitations)).toBeTruthy()
})

it('COMPLETED가 아닌 status는 원문과 함께 안내한다', async () => {
  serve('imp_RUN', { ...improved(), status: 'RUNNING' })
  renderPage('imp_RUN')
  expect((await screen.findByText(/진행 중/)).textContent).toContain('RUNNING')
})

it('모르는 status는 원문으로 보인다', async () => {
  serve('imp_ODD', { ...improved(), status: 'WEIRD' })
  renderPage('imp_ODD')
  expect((await screen.findByText(/완료되지 않은 결과/)).textContent).toContain('WEIRD')
})

it('서버 오류(500)이면 불러오지 못함을 안내한다', async () => {
  server.use(http.get('/improvements/imp_500.json', () => new HttpResponse(null, { status: 500 })))
  renderPage('imp_500')
  expect((await screen.findByRole('alert')).textContent).toContain('불러오지 못했습니다')
})

it('네트워크 오류이면 불러오지 못함을 안내한다', async () => {
  server.use(http.get('/improvements/imp_NET.json', () => HttpResponse.error()))
  renderPage('imp_NET')
  expect((await screen.findByRole('alert')).textContent).toContain('불러오지 못했습니다')
})

it('rounds 영역이 오류여도 나머지는 정상이고 개선 회차에 데이터 오류를 보인다', async () => {
  const broken = improved()
  delete broken.rounds[0].round
  serve('imp_RND', broken)
  renderPage('imp_RND')
  await screen.findByText('imp_RND')
  expect(screen.getByRole('region', { name: '개선 회차' }).textContent).toContain('데이터 오류')
  expect(screen.getAllByRole('alert')).toHaveLength(1)
})

it('report 영역이 오류여도 생성 시각은 보인다', async () => {
  const broken = improved()
  delete broken.summary.beforeLabel
  serve('imp_REP', broken)
  renderPage('imp_REP')
  await screen.findByText('imp_REP')
  expect(screen.getByRole('region', { name: '① 개선 효과' }).textContent).toContain('데이터 오류')
  expect(screen.getByText(improved().createdAt)).toBeTruthy()
})

it.each([
  ['누락', (data: Record<string, unknown>) => delete data.limitations],
  ['빈 문자열', (data: Record<string, unknown>) => { data.limitations = '  ' }],
])('limitations가 %s이면 기본 안내 문구를 보인다', async (name, mutate) => {
  const data = improved()
  mutate(data)
  const id = `imp_LIM_${name === '누락' ? 'A' : 'B'}`
  serve(id, data)
  renderPage(id)
  await screen.findByText(id)
  expect(screen.getByText(/실제 사용자 클릭률이나 UX 개선 효과를 입증하지 않습니다/)).toBeTruthy()
})

it('영역 오류가 있고 limitations도 없어도 기본 안내 문구를 보인다', async () => {
  const data = improved()
  delete data.limitations
  delete data.verification.status
  serve('imp_LIM_C', data)
  renderPage('imp_LIM_C')
  await screen.findByText('imp_LIM_C')
  expect(screen.getByRole('region', { name: '② 실제 브라우저 검증' }).textContent).toContain('데이터 오류')
  expect(screen.getByText(/실제 사용자 클릭률이나 UX 개선 효과를 입증하지 않습니다/)).toBeTruthy()
})
