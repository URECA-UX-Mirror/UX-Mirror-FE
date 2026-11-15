import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useMock } from './config/env.ts'

async function enableMocking() {
  if (!useMock) return
  // mock 코드는 VITE_USE_MOCK=true일 때만 불러온다.
  const { worker } = await import('./mocks/browser.ts')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

enableMocking()
  .catch((error: unknown) => {
    // mock을 켜지 못해도 화면은 뜬다. 이때 API 호출은 실제 주소로 나간다.
    console.error('MSW를 시작하지 못했습니다', error)
  })
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
