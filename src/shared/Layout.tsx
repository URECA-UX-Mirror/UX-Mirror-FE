import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useMock } from '../config/env.ts'
import { mockRuntime } from '../config/runtime.ts'
import { EngineStatus } from './EngineStatus.tsx'
import { PAGE_NAMES } from './pageNames.ts'
import { useTheme } from './theme.ts'

/**
 * 모든 화면의 틀. 상단 바 하나에 로고 · 메뉴 두 개(진단하기, AI 개선) · 상태 · 테마 버튼만 둔다.
 * 진단·비교 화면은 화면 안의 버튼으로 들어간다. 다른 사이트 진단·후보 비교·지난 결과 재생은 메뉴에 없고 주소로만 연다.
 */
export function Layout() {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="layout-title">
          <span className="layout-logo" aria-hidden="true">M</span>
          UX MIRROR
        </Link>
        <nav className="top-nav" aria-label="주요 메뉴">
          <NavLink to="/" end>{PAGE_NAMES.diagnose}</NavLink>
          <NavLink to="/improvements">{PAGE_NAMES.improvement}</NavLink>
        </nav>
        <div className="layout-status">
          {mockRuntime.running ? (
            <span className="mock-flag">예시 데이터</span>
          ) : useMock ? (
            <span className="mock-flag">예시 데이터를 못 켜서 실제 서버를 쓰는 중</span>
          ) : null}
          <EngineStatus refreshKey={pathname} />
          <button type="button" className="theme-toggle" aria-label={theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기'} onClick={toggle}>
            {theme === 'dark' ? '밝게' : '어둡게'}
          </button>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
