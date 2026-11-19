import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { Layout } from '../src/shared/Layout.tsx'

function renderLayout(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<p>본문</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

it('상단 메뉴는 진단하기와 AI 개선 두 개뿐이다', () => {
  renderLayout()
  const nav = screen.getByRole('navigation', { name: '주요 메뉴' })
  const links = within(nav).getAllByRole('link')
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['진단하기', '/'],
    ['AI 개선', '/improvements'],
  ])
  // 메뉴에서 뺀 화면은 링크가 없다
  expect(screen.queryByRole('link', { name: /다른 사이트|후보 비교|지난 결과/ })).toBeNull()
  expect(screen.queryByRole('separator')).toBeNull()
})

it.each([
  ['/', '진단하기'],
  ['/improvements', 'AI 개선'],
  ['/improvements/imp_1', 'AI 개선'],
])('%s에서는 %s 메뉴가 현재 화면으로 표시된다', (path, name) => {
  renderLayout(path)
  expect(screen.getByRole('link', { name }).getAttribute('aria-current')).toBe('page')
})

it('로고를 누르면 첫 화면으로 간다', () => {
  renderLayout('/runs/run_1')
  expect(screen.getByRole('link', { name: /UX MIRROR/ }).getAttribute('href')).toBe('/')
  expect(screen.getByText('본문')).toBeTruthy()
})

it('테마 버튼으로 어둡게·밝게 바꾸고 선택을 저장한다', () => {
  renderLayout()
  const toggle = screen.getByRole('button', { name: /어두운 화면으로|밝은 화면으로/ })
  const start = document.documentElement.dataset.theme
  fireEvent.click(toggle)
  const next = document.documentElement.dataset.theme
  expect(next === 'dark' || next === 'light').toBe(true)
  expect(next).not.toBe(start)
  expect(localStorage.getItem('um.theme')).toBe(next)
  fireEvent.click(screen.getByRole('button', { name: /어두운 화면으로|밝은 화면으로/ }))
  expect(document.documentElement.dataset.theme).toBe(next === 'dark' ? 'light' : 'dark')
})

it('저장한 테마가 있으면 그 테마로 시작한다', () => {
  localStorage.setItem('um.theme', 'dark')
  renderLayout()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByRole('button', { name: '밝은 화면으로 바꾸기' })).toBeTruthy()
})

it('저장한 테마가 없으면 기기 설정을 따르고 data-theme을 두지 않는다', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  renderLayout()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(screen.getByRole('button', { name: '밝은 화면으로 바꾸기' })).toBeTruthy()
  vi.unstubAllGlobals()
})
