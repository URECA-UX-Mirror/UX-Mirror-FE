import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ScreenshotViewer } from '../src/shared/screenshot/ScreenshotViewer.tsx'

it('실패 자리표시와 진행 상태 및 retryKey 변경 후 재시도', () => {
  const props = { src: '/image.png', alt: '화면', viewport: { width: 1440, height: 900 }, boxes: [], runInProgress: true, retryKey: 1 }
  const { rerender } = render(<ScreenshotViewer {...props} />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('status').textContent).toBe('화면 준비 중')
  rerender(<ScreenshotViewer {...props} retryKey={2} />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('status').textContent).toBe('화면 준비 중')
  rerender(<ScreenshotViewer {...props} retryKey={2} runInProgress={false} />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('status').textContent).toBe('화면 없음')
})
