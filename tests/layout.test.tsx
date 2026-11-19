import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it } from 'vitest'
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
  delete document.documentElement.dataset.theme
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

it('사이드바에 진단하기·AI 개선 결과·다른 사이트 진단·지난 결과 다시 보기·메뉴 이름 후보 비교 메뉴가 있다', () => {
  renderLayout()
  const nav = screen.getByRole('navigation', { name: '주요 메뉴' })
  expect(Array.from(nav.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['진단하기', '/'],
    ['AI 개선 결과', '/improvements'],
    ['다른 사이트 진단', '/scenario'],
    ['지난 결과 다시 보기', '/replay'],
    ['메뉴 이름 후보 비교', '/optimizations'],
  ])
})

it.each([
  ['/scenario', '다른 사이트 진단'],
  ['/improvements', 'AI 개선 결과'],
  ['/improvements/imp_1', 'AI 개선 결과'],
  ['/runs/run_1/result', '진단 결과'],
  ['/runs/run_1', '진단 중'],
])('%s에서 상단 바에 화면 이름(%s)을 보인다', (path, name) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<p>본문</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByLabelText('현재 위치').textContent).toBe(`/${name}`)
})

it('상단 바에 새 진단 링크가 있고 개발자용 문구는 없다', () => {
  renderLayout()
  expect(screen.getByRole('link', { name: '새 진단' }).getAttribute('href')).toBe('/')
  expect(screen.queryByText(/mock|MSW/i)).toBeNull()
})

it('테마 버튼으로 어두운 화면과 밝은 화면을 바꾸고 고른 값을 저장한다', () => {
  renderLayout()
  fireEvent.click(screen.getByRole('button', { name: '어두운 화면으로 바꾸기' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('um.theme')).toBe('dark')
  const back = screen.getByRole('button', { name: '밝은 화면으로 바꾸기' })
  expect(back.textContent).toBe('밝게')
  fireEvent.click(back)
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('um.theme')).toBe('light')
  expect(screen.getByRole('button', { name: '어두운 화면으로 바꾸기' }).textContent).toBe('어둡게')
})

it('저장된 테마가 있으면 그 테마로 시작한다', () => {
  localStorage.setItem('um.theme', 'dark')
  renderLayout()
  expect(screen.getByRole('button', { name: '밝은 화면으로 바꾸기' })).toBeTruthy()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('저장된 테마가 없으면 기기 설정을 따르고 화면에 테마를 적지 않는다', () => {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({ matches: query.includes('dark'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  try {
    renderLayout()
    expect(screen.getByRole('button', { name: '밝은 화면으로 바꾸기' })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  } finally {
    window.matchMedia = original
  }
})
