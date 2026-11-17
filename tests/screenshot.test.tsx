import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CandidateProbabilityList } from '../src/shared/screenshot/CandidateProbabilityList.tsx'
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

it('후보 박스에는 번호 태그만 올리고 확률 숫자는 올리지 않는다', () => {
  const viewport = { width: 1440, height: 900 }
  const boxes = [
    { id: 'a', bbox: { x: 100, y: 300, width: 80, height: 30 }, tag: 1 },
    // 화면 맨 위에 붙은 박스는 태그가 잘리지 않게 박스 아래에 둔다
    { id: 'b', bbox: { x: 100, y: 10, width: 80, height: 30 }, tag: 2, highlighted: true },
  ]
  const { container } = render(
    <ScreenshotViewer src="/i.png" alt="화면" viewport={viewport} boxes={boxes} runInProgress={false} />,
  )
  const tags = [...container.querySelectorAll('.screenshot-box-tag')]
  expect(tags.map((tag) => tag.textContent)).toEqual(['1', '2'])
  expect(tags[0].classList.contains('screenshot-box-tag-below')).toBe(false)
  expect(tags[1].classList.contains('screenshot-box-tag-below')).toBe(true)
  expect(container.textContent).not.toContain('%')
})

it('후보 확률 목록은 번호, 게이지, 확률 숫자를 함께 보이고 GO_BACK 행은 값이 있을 때만 만든다', () => {
  const candidates = [
    { optionId: 'o1', label: '환불 신청', probability: 0.62, selected: true },
    { optionId: 'o2', label: '마이페이지', probability: 0.15, selected: false },
  ]
  const { container, rerender } = render(
    <CandidateProbabilityList candidates={candidates} decision={{ selectedActionType: 'CLICK', goBackProbability: 0.1 }} />,
  )
  const rows = [...container.querySelectorAll('li')]
  expect(rows).toHaveLength(3)
  expect(rows[0].querySelector('.candidate-no')?.textContent).toBe('1')
  expect(rows[0].textContent).toContain('62.0%')
  expect((rows[0].querySelector('.gauge-fill') as HTMLElement).style.width).toBe('62%')
  rerender(<CandidateProbabilityList candidates={candidates} decision={{ selectedActionType: 'CLICK', goBackProbability: null }} />)
  expect(container.querySelectorAll('li')).toHaveLength(2)
})
