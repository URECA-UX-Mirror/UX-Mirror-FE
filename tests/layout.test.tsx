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

it('사이드바에 새 UX 분석·시나리오 테스트·저장된 결과 재생 메뉴가 있다', () => {
  renderLayout()
  const nav = screen.getByRole('navigation', { name: '주요 메뉴' })
  expect(Array.from(nav.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['새 UX 분석', '/'],
    ['시나리오 테스트', '/scenario'],
    ['저장된 결과 재생', '/replay'],
  ])
})
