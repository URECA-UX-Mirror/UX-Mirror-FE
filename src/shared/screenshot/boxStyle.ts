// bbox 좌표 변환 순수 함수. 공식과 근거는 docs/contracts/screenshot-bbox.md의 "축소 표시 변환" 절이다.

import type { BoundingBox, Size } from '../../domain/types.ts'

export interface Scroll {
  x: number
  y: number
}

/** 컨테이너 크기에 대한 비율(%). 창 크기가 바뀌어도 위치가 어긋나지 않는다. */
export interface BoxStyle {
  left: number
  top: number
  width: number
  height: number
}

/** 두 크기를 같은 비율로 볼 상대 오차. 문서에 없는 값이다(`임시`). */
const RATIO_TOLERANCE = 0.01

/**
 * 좌표 계산의 기준 크기를 고른다. 기본은 `viewport`이고,
 * `screenshotSize`의 가로세로 비율이 viewport와 다르면 `screenshotSize`를 쓴다.
 */
export function pickBaseSize(viewport: Size, screenshotSize?: Size): Size {
  if (!screenshotSize) return viewport
  const viewportRatio = viewport.width / viewport.height
  const screenshotRatio = screenshotSize.width / screenshotSize.height
  return Math.abs(viewportRatio - screenshotRatio) / viewportRatio >
    RATIO_TOLERANCE
    ? screenshotSize
    : viewport
}

/**
 * bbox(CSS 픽셀, 스크린샷 왼쪽 위 기준)를 컨테이너 대비 %로 바꾼다.
 * `scroll`은 `x - scroll.x`, `y - scroll.y`로 보정한다(`임시`).
 * viewport 밖으로 넘치는 부분은 자르지 않는다. 컨테이너의 `overflow: hidden`이 가린다.
 */
export function toBoxStyle(
  bbox: BoundingBox,
  scroll: Scroll,
  base: Size,
): BoxStyle {
  return {
    left: ((bbox.x - scroll.x) / base.width) * 100,
    top: ((bbox.y - scroll.y) / base.height) * 100,
    width: (bbox.width / base.width) * 100,
    height: (bbox.height / base.height) * 100,
  }
}

/** 확률(0~1)을 백분율 문자열로 만든다. 소수 첫째 자리까지 반올림하고 원본 값은 바꾸지 않는다. */
export function formatPercent(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}
