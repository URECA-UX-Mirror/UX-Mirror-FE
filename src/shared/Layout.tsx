import { Link, Outlet, useLocation } from 'react-router'
import { useMock } from '../config/env.ts'
import { mockRuntime } from '../config/runtime.ts'
import { EngineStatus } from './EngineStatus.tsx'

/** 모든 화면의 공통 영역. 엔진 상태는 여기서만 표시한다. */
export function Layout() {
  // 라우트가 바뀔 때마다 엔진 상태(activeRun)를 다시 조회한다.
  const { pathname } = useLocation()
  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-title">
          UX MIRROR
        </Link>
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
  )
}
