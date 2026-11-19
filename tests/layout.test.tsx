import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { Layout } from '../src/shared/Layout.tsx'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>본문</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('um.sidebar.open', '1')
})

it('사이드바 토글 버튼으로 접고 펼친다', () => {
  renderLayout()
  const toggle = screen.getByRole('button', { name: '사이드바 접기' })
  fireEvent.click(toggle)
  expect(screen.getByRole('button', { name: '사이드바 펼치기' }).getAttribute('aria-expanded')).toBe('false')
  expect(localStorage.getItem('um.sidebar.open')).toBe('0')
})

it('방향키로 사이드바 너비를 조절하고 범위를 넘지 않으며 저장한다', () => {
  renderLayout()
  const handle = screen.getByRole('separator', { name: '사이드바 너비 조절' })
  expect(handle.getAttribute('aria-valuenow')).toBe('256')
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(handle.getAttribute('aria-valuenow')).toBe('272')
  fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
  expect(handle.getAttribute('aria-valuenow')).toBe('224')
  fireEvent.keyDown(handle, { key: 'End' })
  expect(handle.getAttribute('aria-valuenow')).toBe('420')
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(handle.getAttribute('aria-valuenow')).toBe('420')
  fireEvent.keyDown(handle, { key: 'Home' })
  expect(handle.getAttribute('aria-valuenow')).toBe('200')
  expect(localStorage.getItem('um.sidebar.width')).toBe('200')
})

it('손잡이를 두 번 누르면 기본 너비로 돌아간다', () => {
  localStorage.setItem('um.sidebar.width', '360')
  renderLayout()
  const handle = screen.getByRole('separator', { name: '사이드바 너비 조절' })
  expect(handle.getAttribute('aria-valuenow')).toBe('360')
  fireEvent.doubleClick(handle)
  expect(handle.getAttribute('aria-valuenow')).toBe('256')
})

/** 최종 리포트 id(`FINAL_IMPROVEMENT_ID`) 설정과 무관하게 테스트하도록 id를 고정해 렌더링한다 */
async function renderLayoutWithFinalId(id: string | null) {
  vi.resetModules()
  vi.doMock('../src/features/improvement/constants.ts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/features/improvement/constants.ts')>()
    return { ...actual, finalImprovementPath: () => actual.finalImprovementPath(id) }
  })
  const { Layout: FreshLayout } = await import('../src/shared/Layout.tsx')
  const view = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<FreshLayout />}>
          <Route index element={<p>본문</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  vi.doUnmock('../src/features/improvement/constants.ts')
  return view
}

it('최종 리포트 id가 없으면 사이드바에 새 UX 분석·시나리오 테스트·UX Optimizer·저장된 결과 재생 메뉴만 있다', async () => {
  await renderLayoutWithFinalId(null)
  const nav = screen.getByRole('navigation', { name: '주요 메뉴' })
  expect(Array.from(nav.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['새 UX 분석', '/'],
    ['시나리오 테스트', '/scenario'],
    ['UX Optimizer', '/optimizations'],
    ['저장된 결과 재생', '/replay'],
  ])
})

it('/scenario에서 상단 바에 화면 이름을 보인다', () => {
  render(
    <MemoryRouter initialEntries={['/scenario']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/scenario" element={<p>본문</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByLabelText('현재 위치').textContent).toContain('시나리오 테스트')
})

it('최종 리포트 id가 없으면 자동 개선 리포트 메뉴를 보이지 않는다', async () => {
  await renderLayoutWithFinalId(null)
  expect(screen.queryByRole('link', { name: '자동 개선 리포트' })).toBeNull()
})

it('최종 리포트 id가 있으면 자동 개선 리포트 메뉴가 그 화면으로 연결된다', async () => {
  await renderLayoutWithFinalId('imp_FINAL_0001')
  expect(screen.getByRole('link', { name: '자동 개선 리포트' }).getAttribute('href')).toBe('/improvements/imp_FINAL_0001')
})
