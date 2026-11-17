import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useMock } from '../config/env.ts'
import { mockRuntime } from '../config/runtime.ts'
import { EngineStatus } from './EngineStatus.tsx'
import { HistoryIcon, PlusCircleIcon } from './icons.tsx'

/** 헤더 브레드크럼에 보이는 화면 이름. 경로는 `App.tsx`의 라우트와 같다 */
function pageTitle(pathname: string): string {
  if (pathname === '/') return '새 UX 분석'
  if (pathname === '/replay') return '저장된 결과 재생'
  if (pathname.startsWith('/comparisons/')) return '버전 비교'
  if (/^\/runs\/[^/]+\/result\/?$/.test(pathname)) return 'UX 탐색 분석 결과'
  if (pathname.startsWith('/runs/')) return 'AI 탐색 진행'
  return ''
}

/**
 * 모든 화면의 공통 영역. 좌측 메뉴에는 주소 인자 없이 열 수 있는 화면만 두고
 * (결과·진행·비교 화면은 runId, experimentKey가 필요해 화면 안의 링크로 들어간다),
 * 엔진 상태는 사이드바 아래에서만 표시한다.
 */
export function Layout() {
  // 라우트가 바뀔 때마다 엔진 상태(activeRun)를 다시 조회한다.
  const { pathname } = useLocation()
  const title = pageTitle(pathname)
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-top">
          <Link to="/" className="layout-title">
            <span className="layout-logo" aria-hidden="true">
              M
            </span>
            UX MIRROR
          </Link>
          <nav className="app-nav" aria-label="주요 메뉴">
            <NavLink to="/" end>
              <PlusCircleIcon />
              새 UX 분석
            </NavLink>
            <NavLink to="/replay">
              <HistoryIcon />
              저장된 결과 재생
            </NavLink>
          </nav>
        </div>
        <div className="sidebar-foot">
          <EngineStatus refreshKey={pathname} />
        </div>
      </aside>
      <div className="app-body">
        <header className="layout-header">
          <div className="breadcrumb" aria-label="현재 위치">
            <span>UX MIRROR</span>
            {title ? (
              <>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">{title}</span>
              </>
            ) : null}
          </div>
          <div className="layout-status">
            {mockRuntime.running ? (
              <span className="mock-flag">MOCK 데이터</span>
            ) : useMock ? (
              <span className="mock-flag">MOCK 시작 실패 · 실제 서버로 요청 중</span>
            ) : null}
            <Link to="/" className="header-link">
              <PlusCircleIcon size={15} />
              새 분석
            </Link>
          </div>
        </header>
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
