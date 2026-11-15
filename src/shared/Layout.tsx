import { Link, Outlet } from 'react-router'
import { useMock } from '../config/env.ts'
import { EngineStatus } from './EngineStatus.tsx'

/** 모든 화면의 공통 영역. 엔진 상태는 여기서만 표시한다. */
export function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-title">
          UX MIRROR
        </Link>
        <div className="layout-status">
          {useMock ? <span className="mock-flag">MOCK 데이터</span> : null}
          <EngineStatus />
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
