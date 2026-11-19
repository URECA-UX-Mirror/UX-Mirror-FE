import { Link, Outlet, useLocation } from 'react-router'
import { useMock } from '../config/env.ts'
import { mockRuntime } from '../config/runtime.ts'
import { EngineStatus } from './EngineStatus.tsx'
import { useTheme } from './theme.ts'

/**
 * 모든 화면의 틀. 얇은 상단 줄 하나에 로고 · "새 진단" · 상태 · 테마 버튼만 둔다.
 * 다른 화면은 화면 안의 링크나 주소로만 연다.
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
          <Link to="/">새 진단</Link>
        </nav>
        <div className="layout-status">
          {mockRuntime.running ? (
            <span className="mock-flag">예시 데이터</span>
          ) : useMock ? (
            <span className="mock-flag">예시 데이터를 못 켜서 실제 서버를 쓰는 중</span>
          ) : null}
          <EngineStatus refreshKey={pathname} />
          <button type="button" className="theme-toggle" aria-label={theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기'} onClick={toggle}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
