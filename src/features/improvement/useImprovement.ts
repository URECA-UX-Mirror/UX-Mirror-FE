import { useEffect, useState } from 'react'
import { toImprovementView } from '../../adapters/improvement.ts'
import type { ImprovementView } from '../../domain/improvement.ts'

// 자동 개선 결과는 정적 파일(`/improvements/<id>.json`)이다. 폴링 없이 한 번 읽는다(OI-13).
export type ImprovementLoadState =
  | { phase: 'loading' }
  | { phase: 'success'; view: ImprovementView }
  /** 파일이 없거나, 허용되지 않는 id이거나, 개발 서버가 `index.html`로 되돌린 경우 */
  | { phase: 'notFound' }
  | { phase: 'parseError' }
  | { phase: 'error' }

/** `improvementId`는 파일명으로만 쓴다. 이 밖의 문자는 요청하지 않는다(경로 조작 방지) */
const SAFE_ID = /^[A-Za-z0-9_-]+$/

export const isSafeImprovementId = (id: string) => SAFE_ID.test(id)

async function load(id: string, signal: AbortSignal): Promise<ImprovementLoadState> {
  const response = await fetch(`/improvements/${id}.json`, { signal })
  if (response.status === 404) return { phase: 'notFound' }
  if (!response.ok) return { phase: 'error' }
  // SPA fallback이 없는 id에 `index.html`(200)을 돌려주는 경우도 "파일 없음"이다.
  const contentType = response.headers.get('content-type') ?? ''
  if (!/json/i.test(contentType)) return { phase: 'notFound' }
  let json: unknown
  try {
    json = await response.json()
  } catch (error) {
    // 본문을 읽는 중 취소되면 파싱 오류가 아니다. 호출한 쪽이 취소를 판단하게 그대로 던진다.
    if (signal.aborted) throw error
    return { phase: 'parseError' }
  }
  return { phase: 'success', view: toImprovementView(json) }
}

/** 주소의 id가 바뀌면 호출하는 쪽이 `key`로 새로 마운트한다 */
export function useImprovement(improvementId: string): ImprovementLoadState {
  const safe = isSafeImprovementId(improvementId)
  const [state, setState] = useState<ImprovementLoadState>({ phase: 'loading' })

  useEffect(() => {
    if (!safe) return
    const controller = new AbortController()
    load(improvementId, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setState(next)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error(error)
        setState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [improvementId, safe])

  return safe ? state : { phase: 'notFound' }
}
