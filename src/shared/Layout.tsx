import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useMock } from '../config/env.ts'
import { mockRuntime } from '../config/runtime.ts'
import { EngineStatus } from './EngineStatus.tsx'
import { GlobeIcon, HistoryIcon, MenuIcon, PlusCircleIcon } from './icons.tsx'

const SIDEBAR_KEY = 'um.sidebar.open'
const WIDTH_KEY = 'um.sidebar.width'
const WIDTH_DEFAULT = 256
const WIDTH_MIN = 200
const WIDTH_MAX = 420

function clampWidth(value: number): number {
  return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(value)))
}

/** 저장된 사이드바 너비. 없거나 숫자가 아니면 기본값 */
function initialWidth(): number {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    if (Number.isFinite(saved) && saved > 0) return clampWidth(saved)
  } catch {
    // 저장소를 쓸 수 없으면 기본값을 쓴다
  }
  return WIDTH_DEFAULT
}

/** 상단 바 브레드크럼에 보이는 화면 이름. 경로는 `App.tsx`의 라우트와 같다 */
function pageTitle(pathname: string): string {
  if (pathname === '/') return '새 UX 분석'
  if (pathname === '/scenario') return '시나리오 테스트'
  if (pathname === '/replay') return '저장된 결과 재생'
  if (pathname.startsWith('/comparisons/')) return '버전 비교'
  if (/^\/runs\/[^/]+\/result\/?$/.test(pathname)) return 'UX 탐색 분석 결과'
  if (pathname.startsWith('/runs/')) return 'AI 탐색 진행'
  return ''
}

/** 저장된 펼침 여부. 저장값이 없거나 읽을 수 없으면 넓은 화면에서만 펼친다 */
function initialOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
  } catch {
    // 저장소를 쓸 수 없으면 기본값을 쓴다
  }
  return typeof window === 'undefined' || window.innerWidth >= 768
}

/**
 * 모든 화면의 공통 영역. 상단 바에는 사이드바 토글·로고·현재 위치·새 분석 버튼을 두고,
 * 사이드바는 접고 펼 수 있다(주소 인자 없이 열 수 있는 화면만 담는다.
 * 결과·진행·비교 화면은 runId, experimentKey가 필요해 화면 안의 링크로 들어간다).
 * 엔진 상태는 사이드바 아래에서만 표시한다.
 */
export function Layout() {
  // 라우트가 바뀔 때마다 엔진 상태(activeRun)를 다시 조회한다.
  const { pathname } = useLocation()
  const title = pageTitle(pathname)
  const [open, setOpen] = useState(initialOpen)
  const [width, setWidth] = useState(initialWidth)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0')
    } catch {
      // 저장 실패는 무시한다
    }
  }, [open])

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width))
    } catch {
      // 저장 실패는 무시한다
    }
  }, [width])

  // 윈도 분할자(WAI-ARIA window splitter): 끌기와 방향키로 너비를 바꾼다.
  const onResizeKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 48 : 16
    if (event.key === 'ArrowLeft') setWidth((w) => clampWidth(w - step))
    else if (event.key === 'ArrowRight') setWidth((w) => clampWidth(w + step))
    else if (event.key === 'Home') setWidth(WIDTH_MIN)
    else if (event.key === 'End') setWidth(WIDTH_MAX)
    else return
    event.preventDefault()
  }

  // 좁은 화면에서는 사이드바가 본문을 덮으므로 메뉴를 고르면 닫는다.
  const closeOnMobile = () => {
    if (window.innerWidth < 768) setOpen(false)
  }

  return (
    <div
      className="app-shell"
      data-sidebar={open ? 'open' : 'closed'}
      data-resizing={dragging ? 'true' : undefined}
      style={{ '--um-sidebar-width': `${width}px` } as React.CSSProperties}
    >
      <header className="topbar">
        <button
          type="button"
          className="topbar-toggle"
          aria-label={open ? '사이드바 접기' : '사이드바 펼치기'}
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          <MenuIcon />
        </button>
        <Link to="/" className="layout-title">
          <span className="layout-logo" aria-hidden="true">
            M
          </span>
          UX MIRROR
        </Link>
        <div className="breadcrumb" aria-label="현재 위치">
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
      <div className="app-frame">
        <aside id="app-sidebar" className="app-sidebar" aria-hidden={!open}>
          <nav className="app-nav" aria-label="주요 메뉴">
            <NavLink to="/" end onClick={closeOnMobile} tabIndex={open ? 0 : -1}>
              <PlusCircleIcon />
              새 UX 분석
            </NavLink>
            <NavLink to="/scenario" onClick={closeOnMobile} tabIndex={open ? 0 : -1}>
              <GlobeIcon />
              시나리오 테스트
            </NavLink>
            <NavLink to="/replay" onClick={closeOnMobile} tabIndex={open ? 0 : -1}>
              <HistoryIcon />
              저장된 결과 재생
            </NavLink>
          </nav>
          <div className="sidebar-foot">
            <EngineStatus refreshKey={pathname} />
          </div>
          <div
            className="sidebar-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="사이드바 너비 조절"
            aria-valuemin={WIDTH_MIN}
            aria-valuemax={WIDTH_MAX}
            aria-valuenow={width}
            tabIndex={open ? 0 : -1}
            onKeyDown={onResizeKey}
            onDoubleClick={() => setWidth(WIDTH_DEFAULT)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setDragging(true)
            }}
            onPointerMove={(event) => {
              if (dragging) setWidth(clampWidth(event.clientX))
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          />
        </aside>
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="사이드바 닫기"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
