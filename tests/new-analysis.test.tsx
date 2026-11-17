import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { NewAnalysisPage } from '../src/features/new-analysis/NewAnalysisPage.tsx'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NewAnalysisPage />
    </MemoryRouter>,
  )
}

it('분석 대상·실험·분석 조건·버전별 분석·버전 비교 카드로 구성된다', async () => {
  renderAt('/')
  for (const name of ['분석 대상', '실험', '버전별 분석', '버전 비교']) {
    expect(await screen.findByRole('region', { name })).toBeTruthy()
  }
  // 분석 조건은 fieldset이라 group이고, 이름에 보조 문구가 이어진다
  expect(screen.getByRole('group', { name: /^분석 조건/ })).toBeTruthy()
})

it('버전별 분석 표는 v1·v2 행과 비활성 v3 행을 보이고 v3는 시작할 수 없다', async () => {
  renderAt('/?experimentKey=mock-done')
  const table = await screen.findByRole('table')
  const rows = within(table).getAllByRole('row')
  // 머리글 + v1 + v2 + v3(예정)
  expect(rows).toHaveLength(4)
  expect(await within(table).findByText('run_mock_done_before')).toBeTruthy()
  expect(within(rows[3]).getByRole('button', { name: '비활성' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '+ 버전 추가' }).hasAttribute('disabled')).toBe(true)
})

it('최대 탐색 횟수는 1~15 범위에서 +/- 버튼으로 조절된다', async () => {
  renderAt('/')
  const input = (await screen.findByLabelText('최대 탐색 횟수')) as HTMLInputElement
  expect(input.value).toBe('8')
  fireEvent.click(screen.getByRole('button', { name: '탐색 횟수 늘리기' }))
  expect(input.value).toBe('9')
  fireEvent.change(input, { target: { value: '15' } })
  expect(screen.getByRole('button', { name: '탐색 횟수 늘리기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(input, { target: { value: '1' } })
  expect(screen.getByRole('button', { name: '탐색 횟수 줄이기' }).hasAttribute('disabled')).toBe(true)
})

it('분석 사이트가 MORO MARKET이 아니면 안내를 보이고 분석 시작을 막는다', async () => {
  renderAt('/')
  const input = (await screen.findByLabelText('분석 사이트')) as HTMLInputElement
  expect(input.value).toBe('MORO MARKET')
  expect(screen.queryByText(/분석할 수 없는 사이트입니다/)).toBeNull()
  // 시작 가능한 상태(엔진 준비·프리셋 로드)가 될 때까지 기다린다
  const startButtons = () => screen.getAllByRole('button', { name: '분석 시작' }) as HTMLButtonElement[]
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))

  fireEvent.change(input, { target: { value: 'https://example.com' } })
  expect(input.value).toBe('https://example.com')
  expect(screen.getByText(/분석할 수 없는 사이트입니다/)).toBeTruthy()
  expect(startButtons().every((button) => button.disabled)).toBe(true)

  fireEvent.change(input, { target: { value: '' } })
  expect(screen.getByText('분석 사이트를 입력해 주세요.')).toBeTruthy()
  expect(startButtons().every((button) => button.disabled)).toBe(true)

  // 대소문자·앞뒤 공백은 같은 사이트로 본다
  fireEvent.change(input, { target: { value: '  moro market ' } })
  expect(screen.queryByRole('alert', { name: '' })).toBeNull()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
})
