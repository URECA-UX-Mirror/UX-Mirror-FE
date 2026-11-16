import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useMock } from '../config/env.ts'
import { mockRuntime } from '../config/runtime.ts'
import { EngineStatus } from './EngineStatus.tsx'

/**
 * 모든 화면의 공통 영역. 좌측 메뉴에는 주소 인자 없이 열 수 있는 화면만 둔다
 * (결과·진행·비교 화면은 runId, experimentKey가 필요해 화면 안의 링크로 들어간다).
 * 엔진 상태는 여기서만 표시한다.
 */
export function Layout() {
  // 라우트가 바뀔 때마다 엔진 상태(activeRun)를 다시 조회한다.
  const { pathname } = useLocation()
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="layout-title">
          <span className="layout-logo" aria-hidden="true">
            M
          </span>
          UX MIRROR
        </Link>
        <nav className="app-nav" aria-label="주요 메뉴">
          <NavLink to="/" end>
            새 UX 분석
          </NavLink>
          <NavLink to="/replay">저장된 결과 재생</NavLink>
        </nav>
      </aside>
      <div className="app-body">
        <header className="layout-header">
          <div className="layout-status">
            {mockRuntime.running ? (
              <span className="mock-flag">MOCK 데이터</span>
            ) : useMock ? (
              <span className="mock-flag">MOCK 시작 실패 · 실제 서버로 요청 중</span>
            ) : null}
            <EngineStatus refreshKey={pathname} />
          </div>
        </header>
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
