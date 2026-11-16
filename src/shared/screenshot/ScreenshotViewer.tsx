import { useState } from 'react'
import type { BoundingBox, Size } from '../../domain/types.ts'
import {
  formatPercent,
  pickBaseSize,
  toBoxStyle,
  type Scroll,
} from './boxStyle.ts'

/** 뷰어가 그리는 박스 하나. Step 전용이 아니라서 ④ 비교 화면의 Before/After도 같은 형태로 넘긴다. */
export interface ViewerBox {
  id: string
  bbox: BoundingBox
  label?: string
  /** 0~1. 있으면 박스에 백분율로 표시한다 */
  probability?: number
  highlighted?: boolean
}

interface ScreenshotViewerProps {
  /** `screenshotUrl(runId, stepId)`로 만든 주소. 박스는 항상 같은 Step의 스크린샷과 짝으로 그린다 */
  src: string
  alt: string
  viewport: Size
  screenshotSize?: Size
  scroll?: Scroll
  boxes: ReadonlyArray<ViewerBox>
  /** 이미지가 없을 때 자리표시 문구를 정한다. 진행 중이면 "화면 준비 중", 종료됐으면 "화면 없음" */
  runInProgress: boolean
  /**
   * 값이 바뀌면 이미지 로드 실패 기록을 지우고 다시 불러온다. 진행 중 일시적으로 실패한 이미지를
   * 다음 폴링 응답 때 복구하려면 폴링 회차나 `progress.lastUpdatedAt` 같은 값을 넘긴다.
   */
  retryKey?: string | number
}

const NO_SCROLL: Scroll = { x: 0, y: 0 }

/** 스크린샷 위에 후보 박스를 겹쳐 그린다. 좌표 변환은 `boxStyle.ts`가 한다. */
export function ScreenshotViewer({
  src,
  alt,
  viewport,
  screenshotSize,
  scroll = NO_SCROLL,
  boxes,
  runInProgress,
  retryKey,
}: ScreenshotViewerProps) {
  // 실패한 주소·그때의 진행 여부·`retryKey`를 함께 기억한다. 셋 중 하나라도 달라지면
  // 실패로 보지 않아 이미지를 다시 불러온다(예: 진행 중 실패 뒤 실행 종료).
  const [failed, setFailed] = useState<{
    src: string
    runInProgress: boolean
    retryKey: string | number | undefined
  } | null>(null)
  const base = pickBaseSize(viewport, screenshotSize)
  const missing =
    failed?.src === src &&
    failed.runInProgress === runInProgress &&
    failed.retryKey === retryKey

  return (
    <div
      className="screenshot-viewer"
      style={{ aspectRatio: `${base.width} / ${base.height}` }}
    >
      {missing ? (
        <div className="screenshot-placeholder" role="status">
          {runInProgress ? '화면 준비 중' : '화면 없음'}
        </div>
      ) : (
        <>
          <img
            className="screenshot-image"
            src={src}
            alt={alt}
            onError={() => setFailed({ src, runInProgress, retryKey })}
          />
          {boxes.map((box) => {
            const style = toBoxStyle(box.bbox, scroll, base)
            return (
              <div
                key={box.id}
                className={
                  box.highlighted
                    ? 'screenshot-box screenshot-box-selected'
                    : 'screenshot-box'
                }
                style={{
                  left: `${style.left}%`,
                  top: `${style.top}%`,
                  width: `${style.width}%`,
                  height: `${style.height}%`,
                }}
                title={box.label}
                // 같은 정보가 `CandidateProbabilityList`에 있어 스크린 리더에서는 숨긴다.
                aria-hidden="true"
              >
                {box.probability === undefined ? null : (
                  <span className="screenshot-box-badge">
                    {formatPercent(box.probability)}
                  </span>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
