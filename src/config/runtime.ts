// 실행 중에 정해지는 상태. 환경변수가 아니라서 env.ts와 분리한다.

/**
 * MSW가 실제로 시작됐는지. `VITE_USE_MOCK=true`여도 Service Worker 등록에 실패하면 `false`다.
 * 앱을 그리기 전에 `main.tsx`가 한 번 정하므로 화면은 읽기만 한다.
 */
export const mockRuntime = { running: false }
